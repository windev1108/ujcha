"use client";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Dropdown,
  Input,
  ListBox,
  Pagination,
  Select,
  Table,
  Text,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Filter,
  LayoutGrid,
  MoreVertical,
  Pencil,
  PenLine,
  Plus,
  Search,
} from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import {
  adminFieldStack,
  adminLabelClassProduct,
  adminSelectTriggerCompactClass,
  adminSelectValueCompactClass,
} from "@/lib/admin-form-classes";
import { ROUTES } from "@/lib/routes";
import { adminKeys } from "@/services/admin/keys";
import {
  deleteAdminPost,
  fetchAdminPosts,
  publishAdminPost,
  unpublishAdminPost,
} from "@/services/admin/posts-api";
import type { AdminPost, AdminPostStatus, AdminPostType } from "@/services/admin/types";

import {
  authorInitials,
  postDisplayDate,
  postExcerpt,
  postStatusDotClass,
  postStatusLabelVi,
  postTypeLabelVi,
} from "./posts-display";

const PAGE_SIZE = 10;
const TYPE_ALL = "__all__";

type StatusTab = "all" | AdminPostStatus;

function usePaginationWindow(
  current: number,
  totalPages: number,
  max = 5,
): number[] {
  return useMemo(() => {
    if (totalPages <= 0) return [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [current, totalPages, max]);
}

export function PostsPageClient() {
  const router = useRouter();
  const qc = useQueryClient();
  const { confirm } = useAppDialog();

  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState<string>(TYPE_ALL);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusTab, typeFilter, sort, debouncedSearch]);

  const statusParam =
    statusTab === "all" ? undefined : (statusTab as AdminPostStatus);
  const typeParam =
    typeFilter === TYPE_ALL ? undefined : (typeFilter as AdminPostType);

  const listQuery = useQuery({
    queryKey: adminKeys.posts({
      q: debouncedSearch,
      status: statusParam ?? "",
      type: typeParam ?? "",
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () =>
      fetchAdminPosts({
        q: debouncedSearch || undefined,
        status: statusParam,
        type: typeParam,
        sort,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const data = listQuery.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const pageWindow = usePaginationWindow(safePage, totalPages, 5);

  const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, total);

  const invalidatePosts = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "posts"] });
  };

  const publishMut = useMutation({
    mutationFn: publishAdminPost,
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null);
      invalidatePosts();
    },
  });

  const unpublishMut = useMutation({
    mutationFn: unpublishAdminPost,
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null);
      invalidatePosts();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdminPost,
    onMutate: (id) => setBusyId(id),
    onSettled: () => {
      setBusyId(null);
      invalidatePosts();
    },
  });

  const handleDelete = async (p: AdminPost) => {
    const ok = await confirm({
      title: "Xóa bài viết?",
      description: `Xóa “${p.title}”? Không hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xóa",
    });
    if (ok) deleteMut.mutate(p.id);
  };

  const statusTabs: { id: StatusTab; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "draft", label: "Bản nháp" },
    { id: "published", label: "Đã xuất bản" },
  ];

  return (
    <div className="flex flex-col gap-8 pb-28">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            Nội dung
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            Bài viết
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/55">
            Soạn tin, blog và chương trình khuyến mãi — xuất bản hoặc lưu nháp.
          </p>
        </div>
        <NextLink
          href={ROUTES.POST_NEW}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#1a3c34] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1a3c34]/25 transition hover:bg-[#16352c]"
        >
          <Plus className="size-4" />
          Tạo bài mới
        </NextLink>
      </header>

      <Card className="rounded-2xl border border-black/6 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {statusTabs.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={statusTab === t.id ? "primary" : "ghost"}
                className={
                  statusTab === t.id
                    ? "rounded-full bg-[#1a3c34] font-semibold text-white"
                    : "rounded-full text-foreground/75"
                }
                onPress={() => setStatusTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="relative min-w-0 flex-1 max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground/40"
                aria-hidden
              />
              <Input
                aria-label="Tìm bài viết"
                placeholder="Tìm theo tiêu đề…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-10 w-full rounded-full border-0 bg-[#f3f4f6] py-2 pl-10 pr-4 text-sm ring-1 ring-black/6 placeholder:text-foreground/45"
              />
            </div>

            <div className={`flex min-w-0 flex-wrap gap-4 ${adminFieldStack}`}>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground/55">
                <Filter className="size-3.5" />
                Lọc
              </span>
              <div className="min-w-[min(100%,200px)] max-w-full">
                <p className={adminLabelClassProduct}>Loại nội dung</p>
                <Select
                  className="w-full"
                  value={typeFilter}
                  onChange={(key) => {
                    if (key != null) setTypeFilter(String(key));
                  }}
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerCompactClass}>
                    <Select.Value className={adminSelectValueCompactClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      <ListBox.Item
                        id={TYPE_ALL}
                        textValue="Tất cả"
                        className="rounded-lg text-sm"
                      >
                        Tất cả loại
                      </ListBox.Item>
                      <ListBox.Item
                        id="news"
                        textValue="Tin tức"
                        className="rounded-lg text-sm"
                      >
                        Tin tức
                      </ListBox.Item>
                      <ListBox.Item
                        id="blog"
                        textValue="Blog"
                        className="rounded-lg text-sm"
                      >
                        Blog
                      </ListBox.Item>
                      <ListBox.Item
                        id="promotion"
                        textValue="Khuyến mãi"
                        className="rounded-lg text-sm"
                      >
                        Khuyến mãi
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="min-w-[min(100%,200px)] max-w-full">
                <p className={adminLabelClassProduct}>Sắp xếp</p>
                <Select
                  className="w-full"
                  value={sort}
                  onChange={(key) => {
                    if (key === "newest" || key === "oldest") setSort(key);
                  }}
                  variant="secondary"
                >
                  <Select.Trigger className={adminSelectTriggerCompactClass}>
                    <Select.Value className={adminSelectValueCompactClass} />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover placement="bottom start">
                    <ListBox className="min-w-(--trigger-width) outline-none">
                      <ListBox.Item
                        id="newest"
                        textValue="Mới nhất"
                        className="rounded-lg text-sm"
                      >
                        Mới nhất
                      </ListBox.Item>
                      <ListBox.Item
                        id="oldest"
                        textValue="Cũ nhất"
                        className="rounded-lg text-sm"
                      >
                        Cũ nhất
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 text-xs text-foreground/45">
              <LayoutGrid className="size-4 opacity-60" aria-hidden />
              <span>
                Hiển thị {total === 0 ? 0 : `${from}–${to}`} / {total} bài
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto rounded-2xl border border-black/6 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.12)]">
        <Table.Root className="min-w-[1080px]" aria-label="Danh sách bài viết">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column
                  isRowHeader
                  className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45"
                >
                  Tiêu đề
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Tác giả
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Loại
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Trạng thái
                </Table.Column>
                <Table.Column className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Ngày
                </Table.Column>
                <Table.Column className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/45">
                  Thao tác
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {listQuery.isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <Table.Row key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <Table.Cell key={j} className="px-5 py-4">
                          <div className="h-4 animate-pulse rounded-md bg-black/5" />
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                  : items.map((p) => {
                    const busy = busyId === p.id;
                    return (
                      <Table.Row key={p.id}>
                        <Table.Cell className="max-w-[340px] px-5 py-3">
                          <div className="flex gap-3">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f6] ring-1 ring-black/6">
                              {p.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.thumbnail}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-foreground/30">
                                  <FileText className="size-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1a3c34]">
                                {p.title}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-foreground/50">
                                {postExcerpt(p.content)}
                              </p>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,#71b394_14%,transparent)] text-[10px] font-bold text-[#14532d]">
                              {authorInitials(p.author.phone)}
                            </span>
                            <span className="truncate text-sm text-foreground/80">
                              {p.author.phone}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <Chip
                            size="sm"
                            variant="soft"
                            className="border-0 bg-[color-mix(in_oklab,#71b394_16%,transparent)] font-semibold uppercase tracking-wide text-[#14532d]"
                          >
                            <Chip.Label>
                              {postTypeLabelVi(p.type)}
                            </Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span
                              className={`size-2 shrink-0 rounded-full ${postStatusDotClass(p.status)}`}
                            />
                            {postStatusLabelVi(p.status)}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-sm text-foreground/70">
                          {postDisplayDate(p)}
                        </Table.Cell>
                        <Table.Cell className="px-5 py-3 text-right">
                          <Dropdown.Root>
                            <Dropdown.Trigger
                              className={`inline-flex size-9 items-center justify-center rounded-xl text-foreground outline-none transition-colors hover:bg-black/6 ${busy ? "pointer-events-none opacity-50" : ""}`}
                              aria-label="Thao tác bài viết"
                              isDisabled={busy}
                            >
                              <MoreVertical className="size-4" />
                            </Dropdown.Trigger>
                            <Dropdown.Popover placement="bottom end">
                              <Dropdown.Menu
                                aria-label="Menu bài viết"
                                onAction={(key) => {
                                  const k = String(key);
                                  if (k === "edit") {
                                    router.push(ROUTES.postEdit(p.id));
                                    return;
                                  }
                                  if (k === "publish") publishMut.mutate(p.id);
                                  if (k === "unpublish")
                                    unpublishMut.mutate(p.id);
                                  if (k === "delete") void handleDelete(p);
                                }}
                              >
                                <Dropdown.Item id="edit" textValue="Sửa">
                                  <span className="flex items-center gap-2">
                                    <Pencil className="size-3.5" />
                                    Sửa bài
                                  </span>
                                </Dropdown.Item>
                                {p.status === "draft" ? (
                                  <Dropdown.Item
                                    id="publish"
                                    textValue="Xuất bản"
                                  >
                                    Xuất bản
                                  </Dropdown.Item>
                                ) : null}
                                {p.status === "published" ? (
                                  <Dropdown.Item
                                    id="unpublish"
                                    textValue="Gỡ xuất bản"
                                  >
                                    Gỡ xuất bản
                                  </Dropdown.Item>
                                ) : null}
                                <Dropdown.Item id="delete" textValue="Xóa">
                                  Xóa
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown.Root>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table.Root>
      </Card>

      {!listQuery.isLoading && items.length === 0 ? (
        <p className="text-center text-sm text-foreground/50">
          Không có bài viết phù hợp bộ lọc.
        </p>
      ) : null}

      {total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <Text className="text-xs text-foreground/50">
            Trang {safePage} / {totalPages}
          </Text>
          <Pagination.Root className="w-full justify-end sm:w-auto">
            <Pagination.Content className="flex flex-wrap items-center justify-end gap-1">
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={safePage <= 1}
                  onPress={() => setPage((n) => Math.max(1, n - 1))}
                >
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {pageWindow.map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === safePage}
                    onPress={() => setPage(n)}
                    className={
                      n === safePage
                        ? "min-w-9 rounded-full bg-[#1a3c34] text-white data-[active=true]:bg-[#1a3c34]"
                        : "min-w-9 rounded-full"
                    }
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={safePage >= totalPages}
                  onPress={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination.Root>
        </div>
      ) : null}

      <NextLink
        href={ROUTES.POST_NEW}
        className="fixed bottom-8 right-8 z-20 flex size-14 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-lg shadow-[#1a3c34]/30 transition hover:scale-[1.03] hover:bg-[#16352c]"
        aria-label="Tạo bài mới"
      >
        <PenLine className="size-6" />
      </NextLink>
    </div>
  );
}
