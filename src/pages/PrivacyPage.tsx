import { motion } from "motion/react";
import { Shield, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl p-8 md:p-12"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-accent" />
              Data Collection
            </h2>
            <p>
              We collect information you provide directly to us when you create an account, use our thumbnail generation services, or communicate with us. This includes your email address, profile information, and the prompts/images you upload to our studio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" />
              How We Use Your Data
            </h2>
            <p>
              Your data is used to provide, maintain, and improve our services. Specifically, your prompts and generated thumbnails are stored to provide you with a history of your work and to improve our AI models' performance over time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Third-Party Services
            </h2>
            <p>
              We use Google Gemini API for image generation and Supabase/S3 for data storage. These services have their own privacy policies and data handling practices. We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="pt-8 border-t border-border">
            <p className="text-sm">
              Last updated: April 8, 2026. If you have any questions about this Privacy Policy, please contact us at support@thumio.ai.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
