/*
 * Copyright (C) 2020  Yomichan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * This class is used to control the document focus when a non-body element contains the main scrollbar.
 * Web browsers will not automatically focus a custom element with the scrollbar on load, which results in
 * keyboard shortcuts (e.g. arrow keys) not controlling page scroll. Instead, this class will manually
 * focus a dummy element inside the main content, which gives keyboard scroll focus to that element.
 */
class DocumentFocusController {
    constructor() {
        this._contentScrollFocusElement = document.querySelector('#content-scroll-focus');
    }

    prepare() {
        window.addEventListener('focus', this._onWindowFocus.bind(this), false);
        this._updateFocusedElement(false);
    }

    blurElement(element) {
        element.blur();
        this._updateFocusedElement(false);
    }

    // Private

    _onWindowFocus() {
        this._updateFocusedElement(false);
    }

    _updateFocusedElement(force) {
        const target = this._contentScrollFocusElement;
        if (target === null) { return; }

        const {activeElement} = document;
        if (
            force ||
            activeElement === null ||
            activeElement === document.documentElement ||
            activeElement === document.body
        ) {
            // Get selection
            const selection = window.getSelection();
            const selectionRanges1 = this._getSelectionRanges(selection);

            // Note: This function will cause any selected text to be deselected on Firefox.
            target.focus({preventScroll: true});

            // Restore selection
            const selectionRanges2 = this._getSelectionRanges(selection);
            if (!this._areRangesSame(selectionRanges1, selectionRanges2)) {
                this._setSelectionRanges(selection, selectionRanges1);
            }
        }
    }

    _getSelectionRanges(selection) {
        const ranges = [];
        for (let i = 0, ii = selection.rangeCount; i < ii; ++i) {
            ranges.push(selection.getRangeAt(i));
        }
        return ranges;
    }

    _setSelectionRanges(selection, ranges) {
        selection.removeAllRanges();
        for (const range of ranges) {
            selection.addRange(range);
        }
    }

    _areRangesSame(ranges1, ranges2) {
        const ii = ranges1.length;
        if (ii !== ranges2.length) {
            return false;
        }

        for (let i = 0; i < ii; ++i) {
            const range1 = ranges1[i];
            const range2 = ranges2[i];
            try {
                if (
                    range1.compareBoundaryPoints(Range.START_TO_START, range2) !== 0 ||
                    range1.compareBoundaryPoints(Range.END_TO_END, range2) !== 0
                ) {
                    return false;
                }
            } catch (e) {
                return false;
            }
        }

        return true;
    }
}
