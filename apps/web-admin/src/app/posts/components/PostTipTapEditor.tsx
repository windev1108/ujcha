"use client";

import "./post-tiptap.css";

import { Button, Input, Label, Modal, useOverlayState } from "@heroui/react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { adminInputClass, adminLabelClass } from "@/lib/admin-form-classes";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function ToolbarButton({
  onPress,
  active,
  children,
  title,
}: {
  onPress: () => void;
  active?: boolean;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onPress}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${
        active
          ? "bg-[#1a3c34] text-white"
          : "text-foreground/80 hover:bg-black/6"
      }`}
    >
      {children}
    </button>
  );
}

export function PostTipTapEditor({
  value,
  onChange,
  placeholder = "Soạn nội dung… Kéo thả ảnh hoặc dán ảnh từ clipboard.",
  disabled,
}: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const imageModal = useOverlayState({
    isOpen: imageOpen,
    onOpenChange: setImageOpen,
  });
  const linkModal = useOverlayState({
    isOpen: linkOpen,
    onOpenChange: setLinkOpen,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { HTMLAttributes: { class: "list-disc pl-4" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-4" } },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-h-[480px] w-auto max-w-full rounded-lg object-contain",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "text-[#14532d] underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: value || "<p></p>",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "max-w-none min-h-[280px] px-3 py-3 text-sm leading-relaxed text-foreground focus:outline-none [&_.is-editor-empty:first-child::before]:text-foreground/35 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_a]:text-[#14532d] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#71b394] [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:mx-auto [&_img]:my-2 [&_img]:block [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2",
      },
      handleDrop(view, event, _slice, moved) {
        if (disabled || moved) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (!file?.type.startsWith("image/")) return false;
        event.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          const pos = coords?.pos ?? view.state.selection.from;
          const node = view.state.schema.nodes.image?.create({ src });
          if (node) {
            view.dispatch(view.state.tr.insert(pos, node));
          }
        };
        reader.readAsDataURL(file);
        return true;
      },
      handlePaste(view, event) {
        if (disabled) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;
            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              const node = view.state.schema.nodes.image?.create({ src });
              if (node) {
                view.dispatch(
                  view.state.tr.replaceSelectionWith(node).scrollIntoView(),
                );
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const cur = editor.getHTML();
    if (value !== cur) {
      editor.commands.setContent(value || "<p></p>");
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-xl bg-black/[0.06] ring-1 ring-black/6" />
    );
  }

  const openImageFromUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
    setImageUrl("");
    imageModal.close();
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const empty = editor.state.selection.empty;
    if (empty) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${url}</a> `)
        .run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkOpen(false);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 bg-[#fafafa] ring-1 ring-black/6 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-black/8 bg-white px-2 py-2">
        <ToolbarButton
          title="Đậm"
          active={editor.isActive("bold")}
          onPress={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Nghiêng"
          active={editor.isActive("italic")}
          onPress={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Tiêu đề 2"
          active={editor.isActive("heading", { level: 2 })}
          onPress={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Tiêu đề 3"
          active={editor.isActive("heading", { level: 3 })}
          onPress={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Danh sách"
          active={editor.isActive("bulletList")}
          onPress={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Đánh số"
          active={editor.isActive("orderedList")}
          onPress={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Trích dẫn"
          active={editor.isActive("blockquote")}
          onPress={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Đường kẻ ngang"
          onPress={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="size-4" />
        </ToolbarButton>
        <div className="mx-1 h-6 w-px bg-black/10" />
        <ToolbarButton
          title="Chèn liên kết"
          active={editor.isActive("link")}
          onPress={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            setLinkUrl(prev ?? "https://");
            linkModal.open();
          }}
        >
          <Link2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Chèn ảnh từ URL"
          onPress={() => {
            setImageUrl("");
            setImageOpen(true);
          }}
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>
      </div>

      <div className="tiptap-post-editor [&_.tiptap]:outline-none">
        <EditorContent editor={editor} className="tiptap" />
      </div>

      <p className="border-t border-black/6 px-3 py-2 text-[11px] text-foreground/45">
        Gợi ý: kéo thả ảnh vào khung soạn thảo, hoặc dán ảnh từ clipboard. Ảnh
        nội bộ lưu dạng base64 (phù hợp bản nhỏ); ảnh lớn nên dùng URL CDN.
      </p>

      <Modal.Root state={imageModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>Chèn ảnh từ URL</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3 px-5 py-4">
              <div>
                <Label className={adminLabelClass}>URL ảnh</Label>
                <Input
                  className={adminInputClass}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openImageFromUrl();
                  }}
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button variant="ghost" onPress={() => setImageOpen(false)}>
                Huỷ
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={openImageFromUrl}
              >
                Chèn
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <Modal.Root state={linkModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
            <Modal.Header className="border-b border-black/6 px-5 py-4">
              <Modal.Heading>Liên kết</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3 px-5 py-4">
              <div>
                <Label className={adminLabelClass}>URL</Label>
                <Input
                  className={adminInputClass}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                  }}
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
              <Button
                variant="ghost"
                onPress={() => editor.chain().focus().unsetLink().run()}
              >
                Gỡ link
              </Button>
              <Button variant="ghost" onPress={() => setLinkOpen(false)}>
                Huỷ
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={applyLink}
              >
                Áp dụng
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </div>
  );
}
