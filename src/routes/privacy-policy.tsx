import { createFileRoute, Link } from "@tanstack/react-router";
import { contact } from "@/lib/site-data";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Super Plus Fitness" },
      { name: "description", content: "Privacy policy for the Super Plus Fitness website and mobile app." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <main className="bg-background px-6 py-12 sm:py-16 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">Legal</p>
        <h1 className="mt-3 font-display text-5xl font-bold uppercase sm:text-6xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: 3 October 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section>
            <h2 className="text-xl font-bold text-foreground">Who we are</h2>
            <p className="mt-2">Super Plus Fitness &amp; Spa operates a gym, personal training, spa and recovery business at {contact.address}. This policy explains how we handle information through superplusfitness.com and the Super Plus Fitness mobile app.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Information we collect</h2>
            <p className="mt-2">Depending on how you use our services, we may collect your name, email address, phone number, birthday day/month, membership and payment records, gym attendance, bookings, workout-planner entries, visit goals, reward activity, blog likes/comments/saves, app notifications and device push-notification tokens. We also receive basic technical and security information needed to operate our website and app.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Payments</h2>
            <p className="mt-2">Membership payments are processed through Paystack. Super Plus Fitness does not store your full debit or credit card details. We keep the payment and membership records needed to confirm purchases, operate your membership, resolve disputes and meet accounting or legal obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">How we use information</h2>
            <p className="mt-2">We use information to create and manage memberships, authenticate members, record gym visits, calculate SP Points and challenges, process rewards, handle bookings and renewals, send relevant membership or service notifications, support customers, prevent abuse and improve Super Plus services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Service providers</h2>
            <p className="mt-2">We use trusted technology providers to run the service, including payment, authentication, database, hosting, analytics and push-notification providers. They process information only as needed to provide those services and according to their own contractual and privacy obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Data retention and deletion</h2>
            <p className="mt-2">You can delete your Super Plus app account from the Profile screen or through our <Link to="/delete-account" className="font-semibold text-primary underline">account deletion page</Link>. When deletion is confirmed, login access and app-personalization data are removed or anonymized. Some transaction, accounting, fraud-prevention, dispute or legally required business records may be retained for as long as necessary for those purposes and are not used to recreate your deleted app account.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Security</h2>
            <p className="mt-2">We use access controls, authenticated sessions, database permissions and other reasonable safeguards designed to protect member data. No online system can guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Your choices</h2>
            <p className="mt-2">You can choose whether to enable push notifications, sign out at any time, request account deletion, and contact us to ask about your information or correct membership details.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">Contact us</h2>
            <p className="mt-2">For privacy questions, email <a className="font-semibold text-primary underline" href={`mailto:${contact.email}`}>{contact.email}</a> or contact Super Plus Fitness at {contact.address}.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
