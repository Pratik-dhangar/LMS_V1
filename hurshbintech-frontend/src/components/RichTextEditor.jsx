import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import {
    FaBold,
    FaItalic,
    FaUnderline,
    FaStrikethrough,
    FaCode,
    FaListUl,
    FaListOl,
    FaQuoteRight,
    FaUndo,
    FaRedo,
    FaLink,
    FaAlignLeft,
    FaAlignCenter,
    FaAlignRight,
    FaAlignJustify,
    FaImage,
} from 'react-icons/fa';

const MenuBar = ({ editor }) => {
    if (!editor) {
        return null;
    }

    const addImage = () => {
        const url = window.prompt('Enter image URL:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-300 bg-gray-50">
            {/* Heading Buttons */}
            <select
                onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'p') {
                        editor.chain().focus().setParagraph().run();
                    } else {
                        editor.chain().focus().toggleHeading({ level: parseInt(value) }).run();
                    }
                }}
                value={
                    editor.isActive('heading', { level: 1 })
                        ? '1'
                        : editor.isActive('heading', { level: 2 })
                            ? '2'
                            : editor.isActive('heading', { level: 3 })
                                ? '3'
                                : 'p'
                }
                className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
                <option value="p">Paragraph</option>
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
            </select>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Text Formatting */}
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-300' : ''
                    }`}
                title="Bold"
            >
                <FaBold />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-300' : ''
                    }`}
                title="Italic"
            >
                <FaItalic />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-300' : ''
                    }`}
                title="Underline"
            >
                <FaUnderline />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('strike') ? 'bg-gray-300' : ''
                    }`}
                title="Strikethrough"
            >
                <FaStrikethrough />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Text Alignment */}
            <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300' : ''
                    }`}
                title="Align Left"
            >
                <FaAlignLeft />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300' : ''
                    }`}
                title="Align Center"
            >
                <FaAlignCenter />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-300' : ''
                    }`}
                title="Align Right"
            >
                <FaAlignRight />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-300' : ''
                    }`}
                title="Justify"
            >
                <FaAlignJustify />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Lists */}
            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-300' : ''
                    }`}
                title="Bullet List"
            >
                <FaListUl />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-300' : ''
                    }`}
                title="Numbered List"
            >
                <FaListOl />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Blockquote and Code */}
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('blockquote') ? 'bg-gray-300' : ''
                    }`}
                title="Blockquote"
            >
                <FaQuoteRight />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('codeBlock') ? 'bg-gray-300' : ''
                    }`}
                title="Code Block"
            >
                <FaCode />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Link and Image */}
            <button
                onClick={setLink}
                className={`p-2 rounded hover:bg-gray-200 ${editor.isActive('link') ? 'bg-gray-300' : ''
                    }`}
                title="Add Link"
            >
                <FaLink />
            </button>
            <button
                onClick={addImage}
                className="p-2 rounded hover:bg-gray-200"
                title="Add Image"
            >
                <FaImage />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* Undo/Redo */}
            <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo"
            >
                <FaUndo />
            </button>
            <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo"
            >
                <FaRedo />
            </button>
        </div>
    );
};

const RichTextEditor = ({ value, onChange, placeholder = 'Start writing...' }) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-amber-700 underline',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            TextStyle,
            Color,
            Image.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded',
                },
            }),
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(html);
        },
        editorProps: {
            attributes: {
                class:
                    'prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[300px] p-4',
            },
        },
    });

    React.useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value || '');
        }
    }, [value, editor]);

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

export default RichTextEditor;
