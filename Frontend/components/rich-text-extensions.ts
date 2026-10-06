import { Extension, mergeAttributes, Node, type JSONContent } from '@tiptap/react'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import { FontSize } from '@tiptap/extension-text-style/font-size'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

const Column = Node.create({
    name: 'column',
    content: 'block*',
    defining: true,
    parseHTML: () => [{ tag: 'div[data-type="column"]' }],
    renderHTML: ({ HTMLAttributes }) => [
        'div',
        mergeAttributes(HTMLAttributes, {
            'data-type': 'column',
            class: 'rich-text-column',
        }),
        0,
    ],
})

const Columns = Node.create({
    name: 'columns',
    group: 'block',
    content: 'column+',
    defining: true,
    isolating: true,
    addAttributes: () => ({
        columns: {
            default: 2,
            parseHTML: (element: HTMLElement) =>
                Number(element.getAttribute('data-columns')) || 2,
            renderHTML: (attributes: { columns: number }) => ({
                'data-columns': attributes.columns,
            }),
        },
    }),
    parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
    renderHTML: ({ HTMLAttributes }) => [
        'div',
        mergeAttributes(HTMLAttributes, {
            'data-type': 'columns',
            class: 'rich-text-columns',
        }),
        0,
    ],
})

const Indent = Extension.create({
    name: 'paragraphIndent',
    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    indent: {
                        default: 0,
                        parseHTML: (element: HTMLElement) => {
                            const margin = Number.parseFloat(element.style.marginLeft)
                            return Number.isFinite(margin) ? Math.round(margin / 24) : 0
                        },
                        renderHTML: (attributes: { indent?: number }) => {
                            const indent = Number(attributes.indent ?? 0)
                            return indent > 0 ? { style: `margin-left: ${indent * 24}px` } : {}
                        },
                    },
                },
            },
        ]
    },
})

const clampImageWidth = (width: number) => [140, 220, 320].reduce((closest, candidate) =>
    Math.abs(candidate - width) < Math.abs(closest - width) ? candidate : closest,
    220,
)

const LessonImage = Node.create({
    name: 'image',
    group: 'inline',
    inline: true,
    draggable: true,
    atom: true,
    addAttributes() {
        return {
            mediaId: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('data-media-id'),
                renderHTML: (attributes: { mediaId?: string | null }) => attributes.mediaId ? { 'data-media-id': attributes.mediaId } : {},
            },
            src: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('src'),
                renderHTML: (attributes: { src?: string | null }) => attributes.src ? { src: attributes.src } : {},
            },
            alt: {
                default: '',
                parseHTML: (element: HTMLElement) => element.getAttribute('alt') ?? '',
                renderHTML: (attributes: { alt?: string }) => ({ alt: attributes.alt ?? '' }),
            },
            width: {
                default: 220,
                parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-width')) || 220,
                renderHTML: (attributes: { width?: number }) => ({ 'data-width': attributes.width ?? 220 }),
            },
            alignment: {
                default: 'center',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-alignment') ?? 'center',
                renderHTML: (attributes: { alignment?: string }) => ({ 'data-alignment': attributes.alignment ?? 'center' }),
            },
        }
    },
    parseHTML: () => [{ tag: 'img[data-lesson-image]' }],
    renderHTML: ({ HTMLAttributes }) => {
        const width = clampImageWidth(Number(HTMLAttributes['data-width']))
        const alignment = HTMLAttributes['data-alignment'] ?? 'center'
        return ['img', mergeAttributes(HTMLAttributes, {
            'data-lesson-image': 'true',
            'data-lesson-image-trigger': 'true',
            'data-alignment': alignment,
            style: `width: min(${width}px, 100%); max-width: 100%; height: auto; display: block; margin-left: ${alignment === 'right' ? 'auto' : alignment === 'center' ? 'auto' : '0'}; margin-right: ${alignment === 'left' ? 'auto' : alignment === 'center' ? 'auto' : '0'};`,
            role: 'button',
            tabindex: '0',
            'aria-label': HTMLAttributes.alt ? `Phóng lớn: ${HTMLAttributes.alt}` : 'Phóng lớn ảnh minh họa',
        })]
    },
})

export const lessonEditorExtensions = [
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    FontSize,
    Color,
    FontFamily,
    Column,
    Columns,
    Indent,
    LessonImage,
]

export function parseLessonDocument(value: string): JSONContent {
    try {
        const parsed = JSON.parse(value) as JSONContent
        if (parsed.type === 'doc') return parsed
    } catch {
        // Existing lessons are plain text; preserve their line breaks during migration.
    }

    return {
        type: 'doc',
        content: value.split(/\r?\n/).map((line) =>
            line
                ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
                : { type: 'paragraph' },
        ),
    }
}
