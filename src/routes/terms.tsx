import { createFileRoute, Link } from "@tanstack/react-router";
import { contact } from "@/lib/site-data";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Super Plus Fitness" },
      { name: "description", content: "Terms for the Super Plus Fitness website, membership services and mobile app." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="bg-background px-6 py-12 sm:py-16 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">Legal</p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">Terms &amp; Conditions</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: 3 October 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section><h2 className="text-xl font-bold text-foreground">Using Super Plus services</h2><p className="mt-2">These terms apply to the Super Plus Fitness website, mobile app, memberships, bookings, rewards and related digital services. By creating an account, purchasing a membership or using the app, you agree to use the service lawfully and provide accurate information.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Memberships and access</h2><p className="mt-2">Membership access is subject to the plan purchased, its start and end dates, payment status and gym rules. Memberships are personal unless a plan specifically allows otherwise. Physical membership cards and reception attendance records remain the source of truth for gym entry and visit history.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Payments and renewals</h2><p className="mt-2">Prices shown at checkout apply at the time of purchase. Payments are processed through approved payment providers. Renewal benefits, discounts and promotions apply only when their stated conditions are met. Contact us promptly if you believe a payment or membership record is incorrect.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">SP Points and rewards</h2><p className="mt-2">SP Points are a Super Plus loyalty benefit, have no cash value and cannot be sold or transferred unless we expressly allow it. Points may be earned from qualifying membership check-ins, memberships, app engagement or promotions. Duplicate, fraudulent or manipulated activity may be reversed. Reward availability may depend on stock, staffing, appointment availability or service capacity.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Website information</h2><p className="mt-2">Articles and general information published on the public Super Plus website are provided for general informational purposes and are not medical advice.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Website community content</h2><p className="mt-2">Where website commenting is available, members must not post unlawful, abusive, misleading or infringing material. We may moderate or remove content that violates these terms or harms the community.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Account security</h2><p className="mt-2">Keep your login credentials and email account secure. Tell us if you suspect unauthorized access. You are responsible for activity performed through your account until we are notified and can take reasonable protective action.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Changes and availability</h2><p className="mt-2">We may improve, replace or discontinue app features or rewards. We may also update these terms. Material changes will be reflected on this page with a new update date.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Privacy and account deletion</h2><p className="mt-2">Our <Link to="/privacy-policy" className="font-semibold text-primary underline">Privacy Policy</Link> explains how information is handled. You may also use the <Link to="/delete-account" className="font-semibold text-primary underline">account deletion page</Link> to delete your app account.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">Contact</h2><p className="mt-2">Questions about these terms can be sent to <a className="font-semibold text-primary underline" href={`mailto:${contact.email}`}>{contact.email}</a> or raised at {contact.address}.</p></section>
        </div>
      </article>
    </main>
  );
}
