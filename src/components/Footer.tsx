import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

async function footerMenus() {
  const menus = await prisma.menu.findMany({
    where: { location: "FOOTER", active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (menus.length) return menus.map((m) => ({ title: m.title, url: m.url }));
  return [
    { title: "All tours", url: "/search" },
    { title: "ATV & adventure", url: "/activity/atv" },
    { title: "Ubud", url: "/destination/ubud" },
    { title: "Nusa Penida", url: "/destination/nusa-penida" },
    { title: "Blog", url: "/blog" },
  ];
}

export async function Footer() {
  const [links, email, phone, whatsapp] = await Promise.all([
    footerMenus(),
    getSetting("contact_email", "hello@balithingstodo.net"),
    getSetting("contact_phone", "+62 812 3456 7890"),
    getSetting("contact_whatsapp", "+6281234567890"),
  ]);

  return (
    <footer className="mt-16 bg-brand-900 text-brand-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold text-white">🌴 Bali Things To Do</p>
          <p className="mt-3 text-sm leading-relaxed text-brand-200">
            Discover the best tours, activities, adventures and experiences in Bali —
            booked with trusted local suppliers.
          </p>
          <div className="mt-4 flex gap-3 text-lg">
            <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">💬</a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">📸</a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">👥</a>
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-sunset-400">Explore</p>
          <ul className="space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.url + l.title}>
                <Link href={l.url} className="hover:text-white">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-sunset-400">Company</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/support" className="hover:text-white">Support</Link></li>
            <li><Link href="/supplier/register" className="hover:text-white">Become a supplier</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms & conditions</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-sunset-400">Contact</p>
          <ul className="space-y-2 text-sm">
            <li>✉️ {email}</li>
            <li>📞 {phone}</li>
            <li>💬 WhatsApp: {whatsapp}</li>
            <li>📍 Ubud, Bali, Indonesia</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {["Secure booking", "Free cancellation", "Instant confirmation", "Local experts"].map((t) => (
              <span key={t} className="rounded-full bg-brand-800 px-2.5 py-1 text-brand-200">
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-brand-800 py-5 text-center text-xs text-brand-300">
        © {new Date().getFullYear()} Bali Things To Do — www.balithingstodo.net. All rights reserved.
      </div>
    </footer>
  );
}
