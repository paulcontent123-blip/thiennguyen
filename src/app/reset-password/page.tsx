import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SiteHeader } from "@/components/site-header";

export default function ResetPasswordPage() {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-lg px-7 py-20">
        <ResetPasswordForm />
      </section>
    </main>
  );
}
