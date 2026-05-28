"use client";

import {
  Button,
  Card,
  CardContent,
  Description,
  Input,
  Label,
  ListBox,
  Select,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  adminFieldStackLoose,
  adminInputClass,
  adminLabelClass,
  adminSelectTriggerClass,
  adminSelectValueClass,
} from "@/lib/admin-form-classes";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  createAdminPost,
  fetchAdminPost,
  updateAdminPost,
} from "@/services/admin/posts-api";
import type {
  AdminPostStatus,
  AdminPostType,
} from "@/services/admin/types";

import { PostTipTapEditor } from "./PostTipTapEditor";
import { hasMeaningfulHtmlContent, htmlFromMarkdownFallback } from "./post-html";
import { postTypeLabelVi } from "./posts-display";

function parseApiMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: unknown } } })
      .response?.data;
    const m = data?.message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(", ");
  }
  if (err instanceof Error) return err.message;
  return "Không lưu được.";
}

type Props =
  | { mode: "create" }
  | { mode: "edit"; postId: string };

export function PostEditorClient(props: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const postId = props.mode === "edit" ? props.postId : null;

  const existingQuery = useQuery({
    queryKey: adminKeys.post(postId ?? ""),
    queryFn: () => fetchAdminPost(postId!),
    enabled: props.mode === "edit" && Boolean(postId),
  });

  const [title, setTitle] = useState("");
  const [type, setType] = useState<AdminPostType>("blog");
  const [thumbnail, setThumbnail] = useState("");
  const [content, setContent] = useState("<p></p>");
  const [status, setStatus] = useState<AdminPostStatus>("draft");
  /** Bài cũ là markdown — chỉ để hiển thị gợi ý */
  const [loadedAsMarkdown, setLoadedAsMarkdown] = useState(false);

  const editorMountKey = useMemo(
    () =>
      props.mode === "edit"
        ? (existingQuery.data?.id ?? "loading")
        : "create",
    [props.mode, existingQuery.data?.id],
  );

  useEffect(() => {
    const p = existingQuery.data;
    if (!p) return;
    setTitle(p.title);
    setType(p.type);
    setThumbnail(p.thumbnail ?? "");
    setStatus(p.status);
    setLoadedAsMarkdown(p.contentFormat === "markdown");
    setContent(
      p.contentFormat === "markdown"
        ? htmlFromMarkdownFallback(p.content)
        : p.content || "<p></p>",
    );
  }, [existingQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const thumb = thumbnail.trim();
      const body = {
        title: title.trim(),
        content: content.trim(),
        contentFormat: "html" as const,
        type,
        thumbnail: thumb || undefined,
        status,
      };
      if (props.mode === "create") {
        return createAdminPost(body);
      }
      return updateAdminPost(postId!, body);
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["admin", "posts"] });
      void qc.invalidateQueries({ queryKey: adminKeys.post(row.id) });
      if (props.mode === "create") {
        router.replace(ROUTES.postEdit(row.id));
      }
    },
  });

  const loadingExisting =
    props.mode === "edit" &&
    (existingQuery.isLoading || existingQuery.isFetching);

  const errorMsg = saveMut.isError ? parseApiMessage(saveMut.error) : null;

  const canSave =
    title.trim().length > 0 && hasMeaningfulHtmlContent(content);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <NextLink
          href={ROUTES.POSTS}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-black/6"
        >
          <ArrowLeft className="size-4" />
          Danh sách
        </NextLink>
      </div>

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
          {props.mode === "create" ? "Soạn thảo" : "Chỉnh sửa"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
          {props.mode === "create" ? "Tạo bài viết" : "Sửa bài viết"}
        </h1>
        <p className="mt-2 text-sm text-foreground/55">
          Soạn thảo trực quan với TipTap: định dạng chữ, chèn liên kết, ảnh URL
          hoặc kéo thả / dán ảnh. Nội dung lưu dạng HTML.
        </p>
      </header>

      {loadedAsMarkdown ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Bài này trước đây ở dạng <strong>Markdown</strong> — đã chuyển sang
          khung soạn HTML để chỉnh sửa. Khi lưu, bài sẽ được lưu dạng HTML.
        </p>
      ) : null}

      {loadingExisting ? (
        <Card className="rounded-2xl border border-black/6">
          <CardContent className="h-64 animate-pulse p-6" />
        </Card>
      ) : (
        <Card className="rounded-2xl border border-black/6 shadow-sm">
          <CardContent className={`space-y-5 p-6 ${adminFieldStackLoose}`}>
            <div className={adminFieldStackLoose}>
              <Label className={adminLabelClass}>Tiêu đề</Label>
              <Input
                className={adminInputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề bài viết"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>Loại (danh mục)</Label>
                <Select
                  className="w-full"
                  value={type}
                  onChange={(key) => {
                    if (key === "news" || key === "blog" || key === "promotion")
                      setType(key);
                  }}
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerClass}>
                    <Select.Value className={adminSelectValueClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      {(
                        [
                          "news",
                          "blog",
                          "promotion",
                        ] as const
                      ).map((t) => (
                        <ListBox.Item
                          key={t}
                          id={t}
                          textValue={postTypeLabelVi(t)}
                          className="rounded-lg text-sm"
                        >
                          {postTypeLabelVi(t)}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Description className="text-xs text-foreground/50">
                  Đồng bộ với enum <code className="text-[11px]">PostType</code>{" "}
                  trên server.
                </Description>
              </div>

              <div className={adminFieldStackLoose}>
                <Label className={adminLabelClass}>Định dạng lưu</Label>
                <p className="rounded-xl border border-black/8 bg-[#f9fafb] px-3 py-2.5 text-sm text-foreground/75">
                  HTML (TipTap)
                </p>
                <Description className="text-xs text-foreground/50">
                  Luôn lưu <code>contentFormat: html</code> để tương thích trình
                  soạn rich text.
                </Description>
              </div>
            </div>

            <div className={adminFieldStackLoose}>
              <Label className={adminLabelClass}>Ảnh đại diện (URL)</Label>
              <Input
                className={adminInputClass}
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className={adminFieldStackLoose}>
              <Label className={adminLabelClass}>Nội dung</Label>
              <PostTipTapEditor
                key={editorMountKey}
                value={content}
                onChange={setContent}
                placeholder="Soạn bài… Kéo thả ảnh hoặc dán từ clipboard."
              />
            </div>

            <div className={adminFieldStackLoose}>
              <Label className={adminLabelClass}>Trạng thái khi lưu</Label>
              <Select
                className="w-full max-w-xs"
                value={status}
                onChange={(key) => {
                  if (key === "draft" || key === "published") setStatus(key);
                }}
                variant="secondary"
              >
                <Select.Trigger className={adminSelectTriggerClass}>
                  <Select.Value className={adminSelectValueClass} />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover placement="bottom start">
                  <ListBox className="min-w-(--trigger-width) outline-none">
                    <ListBox.Item
                      id="draft"
                      textValue="Nháp"
                      className="rounded-lg text-sm"
                    >
                      Bản nháp
                    </ListBox.Item>
                    <ListBox.Item
                      id="published"
                      textValue="Xuất bản"
                      className="rounded-lg text-sm"
                    >
                      Xuất bản ngay
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
              <Description className="text-xs text-foreground/50">
                “Xuất bản ngay” sẽ gán <code>publishedAt</code> theo logic API.
              </Description>
            </div>

            {errorMsg ? (
              <p className="text-sm text-red-700">{errorMsg}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                className="rounded-full bg-[#1a3c34] font-semibold text-white"
                onPress={() => saveMut.mutate()}
                isDisabled={saveMut.isPending || !canSave}
              >
                <Save className="mr-2 size-4" />
                {saveMut.isPending ? "Đang lưu…" : "Lưu bài"}
              </Button>
              <NextLink
                href={ROUTES.POSTS}
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-foreground/80 ring-1 ring-black/10 transition hover:bg-black/4"
              >
                Huỷ
              </NextLink>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
