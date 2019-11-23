/*
 * Copyright (C) 2016-2020  Yomichan Authors
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

// \u200c (Zero-width non-joiner) appears on Google Docs from Chrome 76 onwards
const IGNORE_TEXT_PATTERN = /\u200c/;


/*
 * TextSourceRange
 */

class TextSourceRange {
    constructor(range, content, imposterContainer, imposterSourceElement) {
        this.range = range;
        this.rangeStartOffset = range.startOffset;
        this.content = content;
        this.imposterContainer = imposterContainer;
        this.imposterSourceElement = imposterSourceElement;
    }

    clone() {
        return new TextSourceRange(this.range.cloneRange(), this.content, this.imposterContainer, this.imposterSourceElement);
    }

    cleanup() {
        if (this.imposterContainer !== null && this.imposterContainer.parentNode !== null) {
            this.imposterContainer.parentNode.removeChild(this.imposterContainer);
        }
    }

    text() {
        return this.content;
    }

    setEndOffset(length) {
        const state = TextSourceRange.seek(this.range.startContainer, this.range.startOffset, length);
        this.range.setEnd(state.node, state.offset);
        this.content = state.content;
        return length - state.remainder;
    }

    setStartOffset(length) {
        const state = TextSourceRange.seek(this.range.startContainer, this.range.startOffset, -length);
        this.range.setStart(state.node, state.offset);
        this.rangeStartOffset = this.range.startOffset;
        this.content = `${state.content}${this.content}`;
        return length - state.remainder;
    }

    getRect() {
        return this.range.getBoundingClientRect();
    }

    getWritingMode() {
        return TextSourceRange._getElementWritingMode(TextSourceRange._getParentElement(this.range.startContainer));
    }

    select() {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.range);
    }

    deselect() {
        const selection = window.getSelection();
        selection.removeAllRanges();
    }

    equals(other) {
        if (!(
            typeof other === 'object' &&
            other !== null &&
            other instanceof TextSourceRange
        )) {
            return false;
        }
        if (this.imposterSourceElement !== null) {
            return (
                this.imposterSourceElement === other.imposterSourceElement &&
                this.rangeStartOffset === other.rangeStartOffset
            );
        } else {
            return this.range.compareBoundaryPoints(Range.START_TO_START, other.range) === 0;
        }
    }

    static seek(node, offset, length) {
        const forward = (length >= 0);
        const state = {
            node,
            offset,
            content: '',
            remainder: (forward ? length : -length)
        };
        if (length === 0) {
            return state;
        }

        const TEXT_NODE = Node.TEXT_NODE;
        const ELEMENT_NODE = Node.ELEMENT_NODE;

        const seekTextNode = forward ? TextSourceRange._seekForwardTextNode : TextSourceRange._seekBackwardTextNode;
        const getNextNode = forward ? TextSourceRange._getNextNode : TextSourceRange._getPreviousNode;
        const shouldEnter = TextSourceRange._shouldEnter;

        let resetOffset = false;

        const ruby = TextSourceRange._getRubyElement(node);
        if (ruby !== null) {
            node = ruby;
            resetOffset = true;
        }

        while (node !== null) {
            let visitChildren = true;
            const nodeType = node.nodeType;

            if (nodeType === TEXT_NODE) {
                state.node = node;
                if (seekTextNode(state, resetOffset)) {
                    break;
                }
                resetOffset = true;
            } else if (nodeType === ELEMENT_NODE) {
                visitChildren = shouldEnter(node);
            }

            node = getNextNode(node, visitChildren);
        }

        return state;
    }

    static getNodesInRange(range) {
        const end = range.endContainer;
        const nodes = [];
        for (let node = range.startContainer; node !== null; node = TextSourceRange._getNextNode(node, true)) {
            nodes.push(node);
            if (node === end) { break; }
        }
        return nodes;
    }

    static anyNodeMatchesSelector(nodeList, selector) {
        for (const node of nodeList) {
            if (TextSourceRange.nodeMatchesSelector(node, selector)) {
                return true;
            }
        }
        return false;
    }

    static nodeMatchesSelector(node, selector) {
        for (; node !== null; node = node.parentNode) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                return node.matches(selector);
            }
        }
        return false;
    }

    // Private functions

    static _seekForwardTextNode(state, resetOffset) {
        const nodeValue = state.node.nodeValue;
        const nodeValueLength = nodeValue.length;
        let content = state.content;
        let offset = resetOffset ? 0 : state.offset;
        let remainder = state.remainder;
        let result = false;

        for (; offset < nodeValueLength; ++offset) {
            const c = nodeValue[offset];
            if (!IGNORE_TEXT_PATTERN.test(c)) {
                content += c;
                if (--remainder <= 0) {
                    result = true;
                    ++offset;
                    break;
                }
            }
        }

        state.offset = offset;
        state.content = content;
        state.remainder = remainder;
        return result;
    }

    static _seekBackwardTextNode(state, resetOffset) {
        const nodeValue = state.node.nodeValue;
        let content = state.content;
        let offset = resetOffset ? nodeValue.length : state.offset;
        let remainder = state.remainder;
        let result = false;

        for (; offset > 0; --offset) {
            const c = nodeValue[offset - 1];
            if (!IGNORE_TEXT_PATTERN.test(c)) {
                content = c + content;
                if (--remainder <= 0) {
                    result = true;
                    --offset;
                    break;
                }
            }
        }

        state.offset = offset;
        state.content = content;
        state.remainder = remainder;
        return result;
    }

    static _getNextNode(node, visitChildren) {
        let next = visitChildren ? node.firstChild : null;
        if (next === null) {
            while (true) {
                next = node.nextSibling;
                if (next !== null) { break; }

                next = node.parentNode;
                if (next === null) { break; }

                node = next;
            }
        }
        return next;
    }

    static _getPreviousNode(node, visitChildren) {
        let next = visitChildren ? node.lastChild : null;
        if (next === null) {
            while (true) {
                next = node.previousSibling;
                if (next !== null) { break; }

                next = node.parentNode;
                if (next === null) { break; }

                node = next;
            }
        }
        return next;
    }

    static _shouldEnter(node) {
        switch (node.nodeName.toUpperCase()) {
            case 'RT':
            case 'SCRIPT':
            case 'STYLE':
                return false;
        }

        const style = window.getComputedStyle(node);
        return !(
            style.visibility === 'hidden' ||
            style.display === 'none' ||
            parseFloat(style.fontSize) === 0);
    }

    static _getRubyElement(node) {
        node = TextSourceRange._getParentElement(node);
        if (node !== null && node.nodeName.toUpperCase() === 'RT') {
            node = node.parentNode;
            return (node !== null && node.nodeName.toUpperCase() === 'RUBY') ? node : null;
        }
        return null;
    }

    static _getParentElement(node) {
        while (node !== null && node.nodeType !== Node.ELEMENT_NODE) {
            node = node.parentNode;
        }
        return node;
    }

    static _getElementWritingMode(element) {
        if (element !== null) {
            const style = window.getComputedStyle(element);
            const writingMode = style.writingMode;
            if (typeof writingMode === 'string') {
                return TextSourceRange._normalizeWritingMode(writingMode);
            }
        }
        return 'horizontal-tb';
    }

    static _normalizeWritingMode(writingMode) {
        switch (writingMode) {
            case 'lr':
            case 'lr-tb':
            case 'rl':
                return 'horizontal-tb';
            case 'tb':
                return 'vertical-lr';
            case 'tb-rl':
                return 'vertical-rl';
            default:
                return writingMode;
        }
    }
}


/*
 * TextSourceElement
 */

class TextSourceElement {
    constructor(element, content='') {
        this.element = element;
        this.content = content;
    }

    clone() {
        return new TextSourceElement(this.element, this.content);
    }

    cleanup() {
        // NOP
    }

    text() {
        return this.content;
    }

    setEndOffset(length) {
        switch (this.element.nodeName.toUpperCase()) {
            case 'BUTTON':
                this.content = this.element.textContent;
                break;
            case 'IMG':
                this.content = this.element.getAttribute('alt');
                break;
            default:
                this.content = this.element.value;
                break;
        }

        let consumed = 0;
        let content = '';
        for (const currentChar of this.content || '') {
            if (consumed >= length) {
                break;
            } else if (!currentChar.match(IGNORE_TEXT_PATTERN)) {
                consumed++;
                content += currentChar;
            }
        }

        this.content = content;

        return this.content.length;
    }

    setStartOffset() {
        return 0;
    }

    getRect() {
        return this.element.getBoundingClientRect();
    }

    getWritingMode() {
        return 'horizontal-tb';
    }

    select() {
        // NOP
    }

    deselect() {
        // NOP
    }

    equals(other) {
        return (
            typeof other === 'object' &&
            other !== null &&
            other instanceof TextSourceElement &&
            other.element === this.element &&
            other.content === this.content
        );
    }
}
