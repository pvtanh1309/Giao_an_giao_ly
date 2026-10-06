'use client'

import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    Columns2,
    Columns3,
    IndentIncrease,
    Italic,
    ImagePlus,
    Minus,
    Underline as UnderlineIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { lessonImageWidths, uploadLessonImage } from '../lib/lesson-media'

type RichTextToolbarProps = {
    editor: Editor
    mode?: 'lesson' | 'program-schedule' | 'reference'
    lessonId?: string
    getAccessToken?: () => Promise<string>
    apiBaseUrl?: string
}

export function RichTextToolbar({ editor, mode = 'lesson', lessonId, getAccessToken, apiBaseUrl = '' }: RichTextToolbarProps) {
    const imageInputRef = useRef<HTMLInputElement>(null)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [imageError, setImageError] = useState('')
    const currentNode = editor.isActive('heading') ? 'heading' : 'paragraph'
    const indent = Number(editor.getAttributes(currentNode).indent ?? 0)
    const scheduleMode = mode === 'program-schedule'
    const lessonMode = mode === 'lesson'
    const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) =>
        event.preventDefault()

    return (
        <div className="rich-text-toolbar" role="toolbar" aria-label="Định dạng văn bản">
            <button type="button" title="In đậm" aria-label="In đậm" aria-pressed={editor.isActive('bold')} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold size={16} />
            </button>
            <button type="button" title="In nghiêng" aria-label="In nghiêng" aria-pressed={editor.isActive('italic')} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic size={16} />
            </button>
            <button type="button" title="Gạch chân" aria-label="Gạch chân" aria-pressed={editor.isActive('underline')} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <UnderlineIcon size={16} />
            </button>
            <span className="rich-text-divider" aria-hidden="true" />
            <button type="button" title="Căn trái" aria-label="Căn trái" aria-pressed={editor.isActive({ textAlign: 'left' })} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                <AlignLeft size={16} />
            </button>
            <button type="button" title="Căn giữa" aria-label="Căn giữa" aria-pressed={editor.isActive({ textAlign: 'center' })} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                <AlignCenter size={16} />
            </button>
            <button type="button" title="Căn phải" aria-label="Căn phải" aria-pressed={editor.isActive({ textAlign: 'right' })} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                <AlignRight size={16} />
            </button>
            {!scheduleMode && <button
                type="button"
                title={indent ? 'Giảm thụt lề' : 'Thụt lề'}
                aria-label={indent ? 'Giảm thụt lề' : 'Thụt lề'}
                onMouseDown={preserveSelection}
                onClick={() => editor.chain().focus().updateAttributes(currentNode, { indent: indent ? indent - 1 : 1 }).run()}
            >
                <IndentIncrease size={16} />
            </button>}
            {!scheduleMode && <>
                <span className="rich-text-divider" aria-hidden="true" />
                <button type="button" title="Chèn đường kẻ" aria-label="Chèn đường kẻ" onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                    <Minus size={16} />
                </button>
            </>}
            {!scheduleMode && [2, 3].map((columnCount) => {
                const Icon = columnCount === 2 ? Columns2 : Columns3
                return (
                    <button
                        key={columnCount}
                        type="button"
                        title={`Chia bố cục thành ${columnCount} cột`}
                        aria-label={`Chia bố cục thành ${columnCount} cột`}
                        onMouseDown={preserveSelection}
                        onClick={() =>
                            editor.chain().focus().insertContent({
                                type: 'columns',
                                attrs: { columns: columnCount },
                                content: Array.from({ length: columnCount }, () => ({
                                    type: 'column',
                                    content: [{ type: 'paragraph' }],
                                })),
                            }).run()
                        }
                    >
                        <Icon size={16} />
                    </button>
                )
            })}
            {!scheduleMode && <select
                aria-label="Font chữ"
                defaultValue="Georgia, serif"
                onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
            >
                <option value="Georgia, serif">Georgia</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="var(--font-sans), sans-serif">Be Vietnam Pro</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
            </select>}
            <select
                aria-label="Cỡ chữ"
                title="Cỡ chữ"
                defaultValue=""
                onChange={(event) => {
                    const chain = editor.chain().focus()
                    if (event.target.value) chain.setFontSize(event.target.value).run()
                    else chain.unsetFontSize().run()
                }}
            >
                <option value="">Mặc định</option>
                {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => <option key={size} value={`${size}px`}>{size}px</option>)}
            </select>
            <label className="rich-text-color" title="Màu chữ">
                <span>Màu</span>
                <input type="color" aria-label="Màu chữ" defaultValue="#24354a" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
            </label>
            {lessonMode && <>
                <span className="rich-text-divider" aria-hidden="true" />
                <button type="button" title="Chèn ảnh minh họa" aria-label="Chèn ảnh minh họa" disabled={uploadingImage} onMouseDown={preserveSelection} onClick={() => imageInputRef.current?.click()}>
                    <ImagePlus size={16} />
                </button>
                <input
                    ref={imageInputRef}
                    className="lesson-image-file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Chọn ảnh minh họa"
                    onChange={async (event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file) return
                        setImageError('')
                        setUploadingImage(true)
                        try {
                            const uploaded = await uploadLessonImage({
                                lessonId: lessonId ?? '',
                                file,
                                apiBaseUrl,
                                getAccessToken,
                            })
                            editor.chain().focus().insertContent({
                                type: 'image',
                                attrs: { mediaId: uploaded.mediaId, src: uploaded.previewSrc, alt: file.name, width: 220, alignment: 'center' },
                            }).run()
                        } catch (error) {
                            setImageError(error instanceof Error ? error.message : 'Không thể chèn ảnh. Hãy thử lại.')
                        } finally {
                            setUploadingImage(false)
                        }
                    }}
                />
                {editor.isActive('image') && <>
                    <select aria-label="Kích thước ảnh" value={editor.getAttributes('image').width ?? 220} onChange={(event) => editor.chain().focus().updateAttributes('image', { width: Number(event.target.value) }).run()}>
                        {lessonImageWidths.map((width) => <option key={width} value={width}>{width}px</option>)}
                    </select>
                    <select aria-label="Căn lề ảnh" value={editor.getAttributes('image').alignment ?? 'center'} onChange={(event) => editor.chain().focus().updateAttributes('image', { alignment: event.target.value }).run()}>
                        <option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option>
                    </select>
                </>}
                {uploadingImage && <span className="lesson-image-upload-status" role="status">Đang tải ảnh lên…</span>}
                {imageError && <span className="lesson-image-upload-error" role="alert">{imageError}</span>}
            </>}
        </div>
    )
}
