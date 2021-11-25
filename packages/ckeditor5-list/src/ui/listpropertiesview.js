/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module TODO
 */

import {
	View,
	ViewCollection,
	FocusCycler,
	SwitchButtonView,
	LabeledFieldView
} from 'ckeditor5/src/ui';
import {
	FocusTracker,
	KeystrokeHandler
} from 'ckeditor5/src/utils';

import InputNumberView from './inputnumberview';
import CollapsibleView from './collapsibleview';

import '../../theme/listproperties.css';

/**
 * TODO
 *
 * @extends module:ui/view~View
 */
export default class ListPropertiesView extends View {
	/**
	 * @inheritDoc
	 */
	constructor( locale, { numberedListPropertyCommands, enabledProperties, styleButtonViews, styleGridAriaLabel } ) {
		super( locale );

		const t = locale.t;
		const cssClasses = [
			'ck',
			'ck-list-properties'
		];

		/**
		 * A collection of the child views.
		 *
		 * @readonly
		 * @member {module:ui/viewcollection~ViewCollection}
		 */
		this.children = this.createCollection();

		/**
		 * TODO
		 *
		 * @readonly
		 * @member {TODO}
		 */
		this.stylesView = null;

		/**
		 * TODO
		 *
		 * @readonly
		 * @member {TODO}
		 */
		this.startIndexFieldView = null;

		/**
		 * TODO
		 *
		 * @readonly
		 * @member {TODO}
		 */
		this.reversedFieldView = null;

		/**
		 * Tracks information about the DOM focus in the view.
		 *
		 * @readonly
		 * @member {module:utils/focustracker~FocusTracker}
		 */
		this.focusTracker = new FocusTracker();

		/**
		 * An instance of the {@link module:utils/keystrokehandler~KeystrokeHandler}.
		 *
		 * @readonly
		 * @member {module:utils/keystrokehandler~KeystrokeHandler}
		 */
		this.keystrokes = new KeystrokeHandler();

		/**
		 * A collection of views that can be focused in the view.
		 *
		 * @readonly
		 * @member {module:ui/viewcollection~ViewCollection}
		 */
		this.focusables = new ViewCollection();

		/**
		 * Helps cycling over {@link #focusables} in the view.
		 *
		 * @readonly
		 * @protected
		 * @member {module:ui/focuscycler~FocusCycler}
		 */
		this.focusCycler = new FocusCycler( {
			focusables: this.focusables,
			focusTracker: this.focusTracker,
			keystrokeHandler: this.keystrokes,
			actions: {
				// Navigate #children backwards using the <kbd>Shift</kbd> + <kbd>Tab</kbd> keystroke.
				focusPrevious: 'shift + tab',

				// Navigate #children forwards using the <kbd>Tab</kbd> key.
				focusNext: 'tab'
			}
		} );

		if ( styleButtonViews ) {
			this.stylesView = this._createStylesView( styleButtonViews, styleGridAriaLabel );
			this.children.add( this.stylesView );
		} else {
			cssClasses.push( 'ck-list-properties_without-styles' );
		}

		if ( numberedListPropertyCommands ) {
			const numberedPropertiesFields = [];

			if ( enabledProperties.startIndex ) {
				this.startIndexFieldView = this._createStartIndexField( numberedListPropertyCommands );
				numberedPropertiesFields.push( this.startIndexFieldView );
			}

			if ( enabledProperties.reversed ) {
				this.reversedFieldView = this._createReversedField( numberedListPropertyCommands );
				numberedPropertiesFields.push( this.reversedFieldView );
			}

			// When there are some style buttons, pack the numbered list properties into a collapsible to separate them.
			if ( styleButtonViews ) {
				const collapsibleView = new CollapsibleView( locale, numberedPropertiesFields );

				collapsibleView.set( {
					label: t( 'List properties' ),
					isCollapsed: true
				} );

				this.children.add( collapsibleView );
			} else {
				this.children.addMany( numberedPropertiesFields );
			}

			cssClasses.push( 'ck-list-properties_with-numbered-properties' );
		}

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: cssClasses
			},
			children: this.children
		} );
	}

	/**
	 * @inheritDoc
	 */
	render() {
		super.render();

		if ( this.stylesView ) {
			for ( const styleButtonView of this.stylesView.children ) {
				// Register the view as focusable.
				this.focusables.add( styleButtonView );

				// Register the view in the focus tracker.
				this.focusTracker.add( styleButtonView.element );
			}
		}

		if ( this.startIndexFieldView ) {
			this.focusables.add( this.startIndexFieldView );
			this.focusTracker.add( this.startIndexFieldView.element );

			// Intercept the `selectstart` event, which is blocked by default because of the default behavior
			// of the DropdownView#panelView.
			// TODO: blocking `selectstart` in the #panelView should be configurable per–drop–down instance.
			this.listenTo( this.startIndexFieldView.element, 'selectstart', ( evt, domEvt ) => {
				domEvt.stopPropagation();
			}, { priority: 'high' } );

			const stopPropagation = data => data.stopPropagation();

			// Since the form is in the dropdown panel which is a child of the toolbar, the toolbar's
			// keystroke handler would take over the key management in the input. We need to prevent
			// this ASAP. Otherwise, the basic caret movement using the arrow keys will be impossible.
			this.keystrokes.set( 'arrowright', stopPropagation );
			this.keystrokes.set( 'arrowleft', stopPropagation );
			this.keystrokes.set( 'arrowup', stopPropagation );
			this.keystrokes.set( 'arrowdown', stopPropagation );
		}

		if ( this.reversedFieldView ) {
			this.focusables.add( this.reversedFieldView );
			this.focusTracker.add( this.reversedFieldView.element );
		}

		// Start listening for the keystrokes coming from #element.
		this.keystrokes.listenTo( this.element );
	}

	focus() {
		this.focusCycler.focusFirst();
	}

	focusLast() {
		this.focusCycler.focusLast();
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		super.destroy();

		this.focusTracker.destroy();
		this.keystrokes.destroy();
	}

	/**
	 * TODO
	 */
	_createStylesView( styleButtons, styleGridAriaLabel ) {
		// TODO: ListView?
		const stylesView = new View( this.locale );

		stylesView.children = stylesView.createCollection( this.locale );
		stylesView.children.addMany( styleButtons );

		stylesView.setTemplate( {
			tag: 'div',
			attributes: {
				'aria-label': styleGridAriaLabel,
				class: [
					'ck',
					'ck-list-styles-list'
				]
			},
			children: stylesView.children
		} );

		stylesView.children.delegate( 'execute' ).to( this );

		return stylesView;
	}

	/**
	 * TODO
	 *
	 * @returns
	 */
	_createStartIndexField( { listStartCommand } ) {
		const t = this.locale.t;
		const startIndexFieldView = new LabeledFieldView( this.locale, createLabeledInputNumber );

		startIndexFieldView.set( {
			label: t( 'Start at' ),
			class: 'ck-numbered-list-properties-start-index'
		} );

		startIndexFieldView.fieldView.set( {
			min: 1,
			step: 1,
			value: 1,
			inputMode: 'numeric'
		} );

		startIndexFieldView.bind( 'isEnabled' ).to( listStartCommand );
		startIndexFieldView.fieldView.bind( 'value' ).to( listStartCommand );
		startIndexFieldView.fieldView.on( 'input', () => {
			const value = startIndexFieldView.fieldView.element.value;

			if ( value !== '' ) {
				const parsedValue = Number.parseInt( value );

				if ( parsedValue < 1 ) {
					startIndexFieldView.errorText = t( 'Start index must be greater than 0.' );
				} else {
					this.fire( 'listStart', parsedValue );
				}
			}
		} );

		return startIndexFieldView;
	}

	/**
	 * TODO
	 *
	 * @returns
	 */
	_createReversedField( { listReversedCommand } ) {
		const t = this.locale.t;
		const reversedButtonView = new SwitchButtonView( this.locale );

		reversedButtonView.set( {
			withText: true,
			label: t( 'Reversed order' ),
			class: 'ck-numbered-list-properties-reversed-order'
		} );

		reversedButtonView.bind( 'isEnabled' ).to( listReversedCommand );
		reversedButtonView.bind( 'isOn' ).to( listReversedCommand, 'value' );
		reversedButtonView.delegate( 'execute' ).to( this, 'listReversed' );

		return reversedButtonView;
	}
}

/**
 * TODO
 *
 * @param {*} labeledFieldView
 * @param {*} viewUid
 * @param {*} statusUid
 * @returns
 */
function createLabeledInputNumber( labeledFieldView, viewUid, statusUid ) {
	const inputView = new InputNumberView( labeledFieldView.locale );

	inputView.set( {
		id: viewUid,
		ariaDescribedById: statusUid,
		inputMode: 'numeric'
	} );

	inputView.bind( 'isReadOnly' ).to( labeledFieldView, 'isEnabled', value => !value );
	inputView.bind( 'hasError' ).to( labeledFieldView, 'errorText', value => !!value );

	inputView.on( 'input', () => {
		// UX: Make the error text disappear and disable the error indicator as the user
		// starts fixing the errors.
		labeledFieldView.errorText = null;
	} );

	labeledFieldView.bind( 'isEmpty', 'isFocused', 'placeholder' ).to( inputView );

	return inputView;
}
