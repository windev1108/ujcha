import type { Metadata } from "next";

import { PostEditorClient } from "../components/PostEditorClient";

export const metadata: Metadata = {
  title: "Tạo bài viết — UjCha Admin",
  description: "Soạn bài mới",
};

export default function PostNewPage() {
  return <PostEditorClient mode="create" />;
}
