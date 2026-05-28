import type { Metadata } from "next";

import { PostsPageClient } from "./components/PostsPageClient";

export const metadata: Metadata = {
    title: "Bài viết — UjCha Admin",
    description: "Tạo và quản lý tin, blog và khuyến mãi",
};

export default function PostsPage() {
    return <PostsPageClient />;
}
