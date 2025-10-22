import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

export default function ShopFooter() {
  return (
    <footer className="w-full bg-black/80 backdrop-blur border-t border-white/10 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Top */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold">Shopify</h3>
            <p className="mt-3 text-sm text-white/70">
              Fresh styles, Fast checkout, Buy & Wear.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                aria-label="Facebook"
                href="#"
                className="rounded-full p-2 border border-white/30 hover:bg-white/10"
              >
                <Facebook className="size-5 text-white" />
              </a>
              <a
                aria-label="Instagram"
                href="#"
                className="rounded-full p-2 border border-white/30 hover:bg-white/10"
              >
                <Instagram className="size-5 text-white" />
              </a>
              <a
                aria-label="Twitter/X"
                href="#"
                className="rounded-full p-2 border border-white/30 hover:bg-white/10"
              >
                <Twitter className="size-5 text-white" />
              </a>
              <a
                aria-label="YouTube"
                href="#"
                className="rounded-full p-2 border border-white/30 hover:bg-white/10"
              >
                <Youtube className="size-5 text-white" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider text-white/70">
              SHOP
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/listing?category=all">
                  All Products
                </Link>
              </li>
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/listing?category=men">
                  Men
                </Link>
              </li>
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/listing?category=women">
                  Women
                </Link>
              </li>
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/listing?category=kids">
                  Kids
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider text-white/70">
              SUPPORT
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/orders">
                  Orders
                </Link>
              </li>
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/account">
                  Account
                </Link>
              </li>
              <li>
                <a className="text-white hover:text-white/80" href="mailto:hello@shopifyy2s2.local">
                  Help Center
                </a>
              </li>
              <li>
                <Link className="text-white hover:text-white/80" to="/shop/returns">
                  Returns & refunds
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter / Contact */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider text-white/70">
              NEWSLETTER
            </h4>
            <p className="mt-3 text-sm text-white/70">
              Get drops & deals. No spam.
            </p>
            <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                className="h-10 bg-transparent border-white/40 text-white placeholder:text-white/60 focus-visible:ring-white focus-visible:ring-offset-0"
              />
              <Button type="submit" className="h-10 bg-white text-black hover:bg-white/90">
                Subscribe
              </Button>
            </form>

            <div className="mt-5 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-white" /> helloshopify@gmail.com
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-white" /> +94 77 000 0000
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-white" /> Colombo, Sri Lanka
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Shopify_Y2S2. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>PayHere</span>
            <span>PayPal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}