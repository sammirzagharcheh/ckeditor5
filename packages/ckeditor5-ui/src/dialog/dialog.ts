/**
 * @license Copyright (c) 2003-2024, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module ui/dialog/dialog
 */

import type View from '../view.js';
import { type Editor, Plugin } from '@ckeditor/ckeditor5-core';
import DialogView, { type DialogViewCloseEvent, DialogViewPosition } from './dialogview.js';
import type { DialogActionButtonDefinition } from './dialogactionsview.js';
import type { DocumentChangeEvent } from '@ckeditor/ckeditor5-engine';

/**
 * The dialog controller class. It is used to show and hide the {@link module:ui/dialog/dialogview~DialogView}.
 */
export default class Dialog extends Plugin {
	/**
	 * The name of the currently visible dialog view instance.
	 *
	 * @observable
	 */
	declare public id: string | null;

	/**
	 * The currently visible dialog view instance.
	 */
	public view?: DialogView;

	/**
	 * The `Dialog` plugin instance which most recently showed the dialog.
	 *
	 * Only one dialog can be visible at once, even if there are many editor instances on the page.
	 * If an editor wants to show a dialog, it should first hide the dialog that is already opened.
	 * But only the `Dialog` instance that showed the dialog is able able to properly hide it.
	 * This is why we need to store it in a globally available space (static property).
	 * This way every `Dialog` plugin in every editor is able to correctly close any open dialog window.
	 */
	private static _visibleDialogPlugin: Dialog | null;

	/**
	 * A flag indicating whether the dialog is currently visible.
	 *
	 * @observable
	 */
	declare public isOpen: boolean;

	/**
	 * A configurable callback called when the dialog is hidden.
	 */
	private _onHide: ( ( dialog: Dialog ) => void ) | undefined;

	/**
	 * @inheritDoc
	 */
	public static get pluginName() {
		return 'Dialog' as const;
	}

	/**
	 * @inheritDoc
	 */
	constructor( editor: Editor ) {
		super( editor );

		this._initShowHideListeners();
		this._initFocusToggler();
		this._initMultiRootIntegration();

		this.set( 'id', null );
	}

	/**
	 * Initiates listeners for the `show` and `hide` events emitted by this plugin.
	 */
	private _initShowHideListeners() {
		this.on<DialogShowEvent>( 'show', ( evt, args ) => {
			this._show( args );
		} );

		// 'low' priority allows to add custom callback between `_show()` and `onShow()`.
		this.on<DialogShowEvent>( 'show', ( evt, args ) => {
			if ( args.onShow ) {
				args.onShow( this );
			}
		}, { priority: 'low' } );

		this.on<DialogHideEvent>( 'hide', () => {
			if ( Dialog._visibleDialogPlugin ) {
				Dialog._visibleDialogPlugin._hide();
			}
		} );

		// 'low' priority allows to add custom callback between `_hide()` and `onHide()`.
		this.on<DialogHideEvent>( 'hide', () => {
			if ( this._onHide ) {
				this._onHide( this );
				this._onHide = undefined;
			}
		}, { priority: 'low' } );
	}

	/**
	 * Initiates keystroke handler for toggling the focus between the editor and dialog view.
	 */
	private _initFocusToggler() {
		const editor = this.editor;

		editor.keystrokes.set( 'Ctrl+F6', ( data, cancel ) => {
			if ( !this.isOpen || this.view!.isModal ) {
				return;
			}

			if ( this.view!.focusTracker.isFocused ) {
				editor.editing.view.focus();
			} else {
				this.view!.focus();
			}

			cancel();
		} );
	}

	/**
	 * Provides an integration between the root attaching and detaching and positioning of the view.
	 */
	private _initMultiRootIntegration() {
		const model = this.editor.model;

		model.document.on<DocumentChangeEvent>( 'change:data', () => {
			if ( !this.view ) {
				return;
			}

			const changedRoots = model.document.differ.getChangedRoots();

			for ( const changes of changedRoots ) {
				if ( changes.state ) {
					this.view.updatePosition();
				}
			}
		} );
	}

	/**
	 * Shows the dialog. If another dialog is currently visible, it will be hidden.
	 * This method is decorated to enable interacting on the `show` event.
	 */
	public show( dialogDefinition: DialogDefinition ): void {
		this.hide();

		this.fire<DialogShowEvent>( `show:${ dialogDefinition.id }`, dialogDefinition );
	}

	/**
	 * Handles creating the {@link module:ui/dialog/dialogview~DialogView} instance and making it visible.
	 */
	private _show( {
		id,
		icon,
		title,
		hasCloseButton = true,
		content,
		actionButtons,
		className,
		isModal,
		position,
		onHide
	}: DialogDefinition ) {
		const editor = this.editor;

		this.view = new DialogView( editor.locale, {
			getCurrentDomRoot: () => {
				return editor.editing.view.getDomRoot( editor.model.document.selection.anchor!.root.rootName )!;
			},
			getViewportOffset: () => {
				return editor.ui.viewportOffset;
			}
		} );

		const view = this.view;

		view.on<DialogViewCloseEvent>( 'close', () => {
			this.hide();
		} );

		editor.ui.view.body.add( view );
		editor.ui.focusTracker.add( view.element! );
		editor.keystrokes.listenTo( view.element! );

		// Unless the user specified a position, modals should always be centered on the screen.
		// Otherwise, let's keep dialogs centered in the editing root by default.
		if ( !position ) {
			position = isModal ? DialogViewPosition.SCREEN_CENTER : DialogViewPosition.EDITOR_CENTER;
		}

		view.set( {
			position,
			isVisible: true,
			className,
			isModal
		} );

		view.setupParts( {
			icon,
			title,
			hasCloseButton,
			content,
			actionButtons
		} );

		this.id = id;

		if ( onHide ) {
			this._onHide = onHide;
		}

		this.isOpen = true;
		Dialog._visibleDialogPlugin = this;
	}

	/**
	 * Hides the dialog. This method is decorated to enable interacting on the `hide` event.
	 */
	public hide(): void {
		if ( Dialog._visibleDialogPlugin ) {
			Dialog._visibleDialogPlugin.fire<DialogHideEvent>( `hide:${ Dialog._visibleDialogPlugin.id }` );
		}
	}

	/**
	 * Destroys the {@link module:ui/dialog/dialogview~DialogView} and cleans up the stored dialog state.
	 */
	private _hide(): void {
		if ( !this.view ) {
			return;
		}

		const editor = this.editor;
		const view = this.view;

		// Reset the content view to prevent its children from being destroyed in the standard
		// View#destroy() (and collections) chain. If the content children were left in there,
		// they would have to be re-created by the feature using the dialog every time the dialog
		// shows up.
		if ( view.contentView ) {
			view.contentView.reset();
		}

		editor.ui.view.body.remove( view );
		editor.ui.focusTracker.remove( view.element! );
		editor.keystrokes.stopListening( view.element! );

		view.destroy();
		editor.editing.view.focus();

		this.id = null;
		this.isOpen = false;
		Dialog._visibleDialogPlugin = null;
	}
}

/**
 * The definition needed to create a {@link module:ui/dialog/dialogview~DialogView}.
 */
export interface DialogDefinition {

	/**
	 * A unique identifier of the dialog. Allows for distinguishing between different dialogs and their visibility.
	 * For instance, when open, the id of currently visible dialog is stored in {@link module:ui/dialog/dialog~Dialog#id}.
	 *
	 * The `id` is also passed along the {@link module:ui/dialog/dialog~DialogShowEvent} and {@link module:ui/dialog/dialog~DialogHideEvent}
	 * events.
	 */
	id: string;

	/**
	 * The SVG string of an icon displayed in dialogs's header. Used only when {@link #title} is also set
	 * and the header is displayed.
	 *
	 * See more in {@link module:ui/icon/iconview~IconView#content}.
	 */
	icon?: string;

	/**
	 * A title displayed in dialogs's header. Also works as an accessible name of the dialog used by assistive technologies.
	 *
	 * When not set, the header is not displayed. Affects {@link #icon} and {@link #hasCloseButton}.
	 */
	title?: string;

	/**
	 * A flag indicating whether the dialog should have a close button in the header.
	 * `true` by default. Works when {@link #title} is also set and the header is displayed.
	 */
	hasCloseButton?: boolean;

	/**
	 * The content of the dialog. It can be a single {@link module:ui/view~View} or an array of views.
	 */
	content?: View | Array<View>;

	/**
	 * The action buttons displayed in the dialog's footer.
	 */
	actionButtons?: Array<DialogActionButtonDefinition>;

	/**
	 * An additional CSS class set on the outermost (`.ck.ck-dialog`) container element allowing for visual customization.
	 */
	className?: string;

	/**
	 * When set `true`, the dialog will become a modal, i.e. it will block the UI until it is closed.
	 */
	isModal?: boolean;

	/**
	 * Available dialog positions. By default, `DialogViewPosition.EDITOR_CENTER` is used for {@link #isModal non-modals},
	 * and `DialogViewPosition.SCREEN_CENTER` for modals.
	 */
	position?: typeof DialogViewPosition[ keyof typeof DialogViewPosition ];

	/**
	 * A callback called when the dialog shows up. It allows for setting up the dialog's {@link #content}.
	 */
	onShow?: ( dialog: Dialog ) => void;

	/**
	 * A callback called when the dialog hides. It allows for cleaning up (e.g. resetting) the dialog's {@link #content}.
	 */
	onHide?: ( dialog: Dialog ) => void;
}

/**
 * An event fired after {@link module:ui/dialog/dialog~Dialog#show} is called.
 *
 * @eventName ~Dialog#show
 */
export type DialogShowEvent = {
	name: 'show' | `show:${ string }`;
	args: [ dialogDefinition: DialogDefinition ];
};

/**
 * An event fired after {@link module:ui/dialog/dialog~Dialog#hide} is called.
 *
 * @eventName ~Dialog#hide
 */
export type DialogHideEvent = {
	name: 'hide' | `hide:${ string }`;
	args: [];
};
