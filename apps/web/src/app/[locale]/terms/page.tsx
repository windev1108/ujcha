import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t("terms_of_service"),
    description: "Điều khoản sử dụng dịch vụ UjCha — quyền lợi, nghĩa vụ và quy định khi sử dụng nền tảng.",
  };
}

const SECTIONS = [
  {
    id: "chap-nhan",
    title: "1. Chấp nhận điều khoản",
    content: [
      {
        subtitle: "",
        body: "Bằng cách tạo tài khoản hoặc sử dụng bất kỳ dịch vụ nào của UjCha, bạn xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi các Điều khoản dịch vụ này. Nếu bạn không đồng ý, vui lòng không sử dụng dịch vụ.",
      },
    ],
  },
  {
    id: "tai-khoan",
    title: "2. Tài khoản người dùng",
    content: [
      {
        subtitle: "Đăng ký",
        body: "Để đặt hàng và tích điểm, bạn cần tạo tài khoản với số điện thoại hợp lệ tại Việt Nam. Một số điện thoại chỉ được liên kết với một tài khoản. Bạn phải cung cấp thông tin chính xác và cập nhật khi có thay đổi.",
      },
      {
        subtitle: "Bảo mật tài khoản",
        body: "Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và toàn bộ hoạt động xảy ra dưới tài khoản của mình. Thông báo ngay cho UjCha nếu phát hiện truy cập trái phép.",
      },
      {
        subtitle: "Độ tuổi",
        body: "Dịch vụ dành cho người dùng từ 16 tuổi trở lên. Người dưới 18 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ hợp pháp.",
      },
    ],
  },
  {
    id: "dat-hang",
    title: "3. Đặt hàng và thanh toán",
    content: [
      {
        subtitle: "Xác nhận đơn hàng",
        body: "Đơn hàng được coi là đã xác nhận khi bạn nhận được thông báo xác nhận từ hệ thống. UjCha có quyền hủy đơn trong trường hợp sản phẩm hết hàng hoặc phát hiện thông tin gian lận.",
      },
      {
        subtitle: "Giá và thanh toán",
        body: "Giá hiển thị trên ứng dụng đã bao gồm VAT (nếu áp dụng). UjCha chấp nhận thanh toán tiền mặt, chuyển khoản ngân hàng và các phương thức được liệt kê trong ứng dụng. Giá có thể thay đổi mà không cần báo trước.",
      },
      {
        subtitle: "Voucher và ưu đãi",
        body: "Voucher chỉ áp dụng theo điều kiện được nêu rõ và không thể quy đổi thành tiền mặt. Mỗi voucher chỉ được dùng một lần trừ khi có quy định khác. UjCha có quyền thu hồi voucher nếu phát hiện sử dụng gian lận.",
      },
    ],
  },
  {
    id: "huy-hoan",
    title: "4. Hủy đơn và hoàn tiền",
    content: [
      {
        subtitle: "Hủy đơn",
        body: "Bạn có thể hủy đơn trong vòng 5 phút kể từ khi đặt hàng thành công nếu đơn chưa được xác nhận bởi cửa hàng. Sau khi cửa hàng xác nhận, đơn hàng không thể hủy.",
      },
      {
        subtitle: "Hoàn tiền",
        body: "Trong trường hợp đơn hàng bị hủy do lỗi từ phía UjCha (hết hàng, lỗi hệ thống), chúng tôi hoàn tiền đầy đủ qua cùng phương thức thanh toán trong vòng 3–7 ngày làm việc.",
      },
      {
        subtitle: "Khiếu nại chất lượng",
        body: "Nếu sản phẩm nhận được không đúng mô tả hoặc kém chất lượng, vui lòng liên hệ trong vòng 1 giờ kể từ khi nhận hàng kèm ảnh chụp. Chúng tôi sẽ xem xét và hoàn tiền/bù đắp trong trường hợp khiếu nại hợp lệ.",
      },
    ],
  },
  {
    id: "diem-thuong",
    title: "5. Điểm thưởng và chương trình khách hàng thân thiết",
    content: [
      {
        subtitle: "Tích điểm",
        body: "Điểm thưởng được tính tự động sau khi đơn hàng hoàn thành theo tỷ lệ hiện hành. Điểm không được tính cho đơn hàng bị hủy hoặc hoàn tiền.",
      },
      {
        subtitle: "Đổi điểm",
        body: "Điểm tích lũy chỉ có thể đổi lấy voucher giảm giá tại trang Phần thưởng. Điểm không có giá trị quy đổi tiền mặt và không thể chuyển nhượng giữa các tài khoản.",
      },
      {
        subtitle: "Hết hạn",
        body: "Điểm không có thời hạn miễn tài khoản vẫn hoạt động. Nếu tài khoản không có giao dịch trong 24 tháng liên tiếp, điểm có thể bị thu hồi với thông báo trước 30 ngày.",
      },
    ],
  },
  {
    id: "cam-ket",
    title: "6. Hành vi bị cấm",
    content: [
      {
        subtitle: "",
        body: "Người dùng không được: (1) Tạo nhiều tài khoản để lạm dụng ưu đãi; (2) Sử dụng công cụ tự động để đặt hàng hoặc tích điểm; (3) Chia sẻ tài khoản với người khác nhằm trục lợi ưu đãi; (4) Cung cấp thông tin sai lệch; (5) Thực hiện bất kỳ hành vi gian lận nào ảnh hưởng đến hệ thống hoặc người dùng khác. Vi phạm có thể dẫn đến khóa tài khoản vĩnh viễn và thu hồi toàn bộ điểm thưởng.",
      },
    ],
  },
  {
    id: "gioi-han",
    title: "7. Giới hạn trách nhiệm",
    content: [
      {
        subtitle: "",
        body: "UjCha cung cấp dịch vụ theo hiện trạng và không đảm bảo dịch vụ sẽ không bị gián đoạn. Trong phạm vi tối đa cho phép bởi pháp luật, UjCha không chịu trách nhiệm cho thiệt hại gián tiếp, ngẫu nhiên hoặc hậu quả phát sinh từ việc sử dụng dịch vụ.",
      },
    ],
  },
  {
    id: "thay-doi",
    title: "8. Thay đổi điều khoản",
    content: [
      {
        subtitle: "",
        body: "UjCha có quyền cập nhật Điều khoản này bất kỳ lúc nào. Thay đổi có hiệu lực ngay khi được đăng tải. Chúng tôi sẽ thông báo qua ứng dụng hoặc email cho các thay đổi quan trọng. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi được coi là bạn đã chấp nhận điều khoản mới.",
      },
    ],
  },
  {
    id: "phap-luat",
    title: "9. Luật áp dụng",
    content: [
      {
        subtitle: "",
        body: "Điều khoản này được điều chỉnh bởi pháp luật nước Cộng hòa xã hội chủ nghĩa Việt Nam. Mọi tranh chấp sẽ được giải quyết tại tòa án có thẩm quyền tại địa phương nơi UjCha đặt trụ sở.",
      },
    ],
  },
  {
    id: "lien-he-dk",
    title: "10. Liên hệ",
    content: [
      {
        subtitle: "",
        body: "Với bất kỳ câu hỏi nào về Điều khoản dịch vụ, vui lòng liên hệ bộ phận hỗ trợ UjCha qua ứng dụng hoặc đến trực tiếp cửa hàng. Chúng tôi sẵn sàng giải đáp trong giờ làm việc.",
      },
    ],
  },
];

export default async function TermsPage() {
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
            <ScrollText className="size-7 text-white" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{t("legal_eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t("terms_of_service")}</h1>
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
              Các điều khoản này điều chỉnh mối quan hệ giữa UjCha và người dùng khi sử dụng ứng dụng
              đặt đồ uống, chương trình tích điểm và các dịch vụ liên quan của UjCha.
            </p>

            <div className="space-y-10">
              {SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="mb-4 text-base font-bold tracking-tight text-foreground">{section.title}</h2>
                  <div className="space-y-4">
                    {section.content.map((block, i) => (
                      <div key={i}>
                        {block.subtitle && (
                          <h3 className="mb-1 text-sm font-semibold text-foreground">{block.subtitle}</h3>
                        )}
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
