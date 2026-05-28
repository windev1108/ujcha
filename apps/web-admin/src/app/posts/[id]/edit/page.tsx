import type { Metadata } from "next";

import { PostEditorClient } from "../../components/PostEditorClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Sửa bài viết — UjCha Admin`,
    description: `Chỉnh sửa bài ${id.slice(0, 8)}…`,
  };
}

export default async function PostEditPage({ params }: Props) {
  const { id } = await params;
  return <PostEditorClient mode="edit" postId={id} />;
}
