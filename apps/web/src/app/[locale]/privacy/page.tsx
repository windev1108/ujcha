import type { Metadata } from "next";
import { Shield } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("privacy_policy"),
    description: "Chính sách bảo mật của UjCha — cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn.",
  };
}

const SECTIONS = [
  {
    id: "thu-thap",
    title: "1. Thông tin chúng tôi thu thập",
    content: [
      {
        subtitle: "Thông tin bạn cung cấp",
        body: "Khi đăng ký tài khoản, bạn cung cấp họ tên, số điện thoại và mật khẩu. Khi đặt hàng, chúng tôi ghi nhận địa chỉ giao hàng và phương thức thanh toán. Các thông tin này là bắt buộc để hoàn tất giao dịch.",
      },
      {
        subtitle: "Thông tin tự động",
        body: "Khi bạn sử dụng ứng dụng, chúng tôi tự động thu thập dữ liệu thiết bị (loại thiết bị, hệ điều hành), địa chỉ IP, lịch sử duyệt web trong ứng dụng và thói quen mua sắm để cải thiện trải nghiệm.",
      },
      {
        subtitle: "Thông tin giao dịch",
        body: "Lịch sử đơn hàng, điểm tích lũy, voucher đã sử dụng và tất cả hoạt động tài chính trong nền tảng UjCha được lưu trữ để phục vụ hỗ trợ khách hàng và chương trình khách hàng thân thiết.",
      },
    ],
  },
  {
    id: "su-dung",
    title: "2. Cách chúng tôi sử dụng thông tin",
    content: [
      {
        subtitle: "Xử lý đơn hàng",
        body: "Thông tin cá nhân được dùng để xử lý, xác nhận và giao đơn hàng đến đúng địa chỉ; thông báo trạng thái đơn qua SMS/thông báo đẩy; và giải quyết khiếu nại liên quan đến giao dịch.",
      },
      {
        subtitle: "Chương trình khách hàng thân thiết",
        body: "Dữ liệu giao dịch được dùng để tính điểm thưởng, xếp hạng thành viên và gửi ưu đãi cá nhân hóa phù hợp với thói quen mua sắm của bạn.",
      },
      {
        subtitle: "Cải thiện dịch vụ",
        body: "Chúng tôi phân tích dữ liệu tổng hợp (ẩn danh) để phát triển sản phẩm mới, tối ưu trải nghiệm ứng dụng và điều chỉnh thực đơn theo nhu cầu thực tế.",
      },
      {
        subtitle: "Liên lạc",
        body: "Chúng tôi có thể gửi thông báo về đơn hàng, cập nhật chính sách và — nếu bạn đồng ý — các ưu đãi marketing qua SMS hoặc email. Bạn có thể hủy đăng ký marketing bất kỳ lúc nào.",
      },
    ],
  },
  {
    id: "chia-se",
    title: "3. Chia sẻ thông tin",
    content: [
      {
        subtitle: "Không bán dữ liệu",
        body: "UjCha cam kết không bán, cho thuê hoặc trao đổi thông tin cá nhân của bạn với bên thứ ba vì mục đích thương mại.",
      },
      {
        subtitle: "Đối tác xử lý",
        body: "Chúng tôi chia sẻ thông tin tối thiểu cần thiết với các đối tác thanh toán (cổng thanh toán ngân hàng), đối tác giao vận và nhà cung cấp dịch vụ SMS để thực hiện giao dịch. Các đối tác này bị ràng buộc bởi thỏa thuận bảo mật nghiêm ngặt.",
      },
      {
        subtitle: "Yêu cầu pháp lý",
        body: "Chúng tôi có thể tiết lộ thông tin khi được yêu cầu bởi cơ quan nhà nước có thẩm quyền theo quy định pháp luật Việt Nam.",
      },
    ],
  },
  {
    id: "bao-ve",
    title: "4. Bảo vệ dữ liệu",
    content: [
      {
        subtitle: "Biện pháp kỹ thuật",
        body: "Toàn bộ dữ liệu được truyền qua kết nối HTTPS mã hóa TLS. Mật khẩu được băm (hash) bằng thuật toán bcrypt và không được lưu dưới dạng văn bản thuần. Thông tin thanh toán nhạy cảm không được lưu trữ trực tiếp trên hệ thống UjCha.",
      },
      {
        subtitle: "Kiểm soát truy cập",
        body: "Chỉ nhân viên có thẩm quyền mới được phép truy cập dữ liệu khách hàng trong phạm vi công việc. Mọi truy cập đều được ghi log và kiểm tra định kỳ.",
      },
    ],
  },
  {
    id: "quyen",
    title: "5. Quyền của bạn",
    content: [
      {
        subtitle: "Truy cập và chỉnh sửa",
        body: "Bạn có quyền xem, chỉnh sửa thông tin cá nhân bất kỳ lúc nào trong phần Hồ sơ của ứng dụng.",
      },
      {
        subtitle: "Xóa tài khoản",
        body: "Bạn có thể yêu cầu xóa tài khoản và toàn bộ dữ liệu cá nhân bằng cách liên hệ bộ phận hỗ trợ. Chúng tôi sẽ xử lý trong vòng 30 ngày làm việc, ngoại trừ dữ liệu cần giữ theo yêu cầu pháp lý.",
      },
      {
        subtitle: "Rút lại đồng ý",
        body: "Bạn có thể hủy đăng ký nhận thông tin marketing bất kỳ lúc nào trong Cài đặt → Thông báo, hoặc liên hệ trực tiếp với chúng tôi.",
      },
    ],
  },
  {
    id: "luu-tru",
    title: "6. Thời gian lưu trữ",
    content: [
      {
        subtitle: "Dữ liệu tài khoản",
        body: "Được lưu trong suốt thời gian tài khoản còn hoạt động và xóa sau 90 ngày kể từ khi tài khoản bị đóng (trừ dữ liệu giao dịch cần lưu theo luật kế toán).",
      },
      {
        subtitle: "Lịch sử giao dịch",
        body: "Theo quy định pháp luật Việt Nam, dữ liệu giao dịch tài chính được lưu tối thiểu 5 năm.",
      },
    ],
  },
  {
    id: "lien-he",
    title: "7. Liên hệ",
    content: [
      {
        subtitle: "Góp ý và khiếu nại",
        body: "Nếu bạn có câu hỏi về chính sách bảo mật hoặc muốn thực hiện quyền của mình, vui lòng liên hệ qua email hỗ trợ hoặc đến trực tiếp cửa hàng UjCha. Chúng tôi cam kết phản hồi trong 3 ngày làm việc.",
      },
    ],
  },
];

export const revalidate = false;

export default async function PrivacyPage() {
  const t = await getTranslations();
  return (
    <div className="min-h-screen bg-surface-soft">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] pb-20 pt-14 sm:pb-24 sm:pt-18">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-80 rounded-full bg-[#99d6b3]/[0.05] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>
        <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <Shield className="size-7 text-white" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{t("legal_eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("privacy_policy")}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
            Cập nhật lần cuối: tháng 5 năm 2026
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="rgb(247,247,247)" />
          </svg>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto max-w-[72rem] px-4 pb-24 pt-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* TOC sidebar */}
          <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-56">
            <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.07)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("table_of_contents")}</p>
              <nav className="mt-3 flex flex-col gap-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-surface-soft hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <article className="min-w-0 flex-1 rounded-3xl border border-black/6 bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.07)] sm:p-8 lg:p-10">
            <p className="mb-8 text-sm leading-relaxed text-foreground/65 border-l-2 border-kun-primary/40 pl-4">
              Tại UjCha, chúng tôi coi trọng sự riêng tư của bạn. Chính sách này giải thích rõ ràng thông tin nào
              được thu thập, mục đích sử dụng và cách chúng tôi bảo vệ dữ liệu cá nhân của bạn khi sử dụng
              ứng dụng và dịch vụ UjCha.
            </p>

            <div className="space-y-10">
              {SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-base font-bold tracking-tight text-foreground">{section.title}</h2>
                  <div className="space-y-4">
                    {section.content.map((block) => (
                      <div key={block.subtitle}>
                        <h3 className="mb-1 text-sm font-semibold text-foreground">{block.subtitle}</h3>
                        <p className="text-sm leading-relaxed text-foreground/65">{block.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
