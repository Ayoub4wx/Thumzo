import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Mail, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";

export default function ContactPage() {
  useDocumentMetadata({
    title: "Contact Thumora AI | AI Thumbnail Maker Support",
    description: "Get help with billing, technical issues, tutorials, or YouTube thumbnail workflows inside Thumora AI.",
    canonicalPath: "/contact",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call to support system
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1200);
  };

  return (
    <div className="relative min-h-screen pt-20 pb-24 overflow-hidden" dir="ltr">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-4">Support</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
            How can we help?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Whether you have a question about credits, found a bug in the editor, or need help with your subscription, we are here for you.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 text-foreground">
                  <Mail className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Email Support</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed mb-2">
                    For billing and account inquiries, email us directly. We typically respond within 24 hours.
                  </p>
                  <a href="mailto:team@thumoraai.com" className="text-foreground font-medium underline underline-offset-4 hover:text-accent transition-colors">
                    team@thumoraai.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 text-foreground">
                  <MessageSquare className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Community Discord</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed mb-2">
                    Join other creators to share thumbnails, give product feedback, and get tips on writing better AI prompts.
                  </p>
                  <a href="#" className="text-foreground font-medium underline underline-offset-4 hover:text-accent transition-colors">
                    Join the Discord
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-[2rem] border border-border bg-card/60 p-6 sm:p-10 shadow-[0_24px_80px_rgba(0,0,0,0.06)]"
          >
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Message Sent</h3>
                <p className="text-muted-foreground">
                  Thanks for reaching out! We've received your message and will get back to you shortly.
                </p>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="mt-8 text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xl font-bold text-foreground mb-6">Send us a message</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name</label>
                    <input
                      id="firstName"
                      required
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name</label>
                    <input
                      id="lastName"
                      className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25"
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="topic" className="text-sm font-medium text-foreground">Topic</label>
                  <select
                    id="topic"
                    className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/25 appearance-none"
                  >
                    <option>Billing & Subscriptions</option>
                    <option>Technical Issue / Bug</option>
                    <option>Feature Request</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25 resize-none"
                    placeholder="How can we help you today?"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Message"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
