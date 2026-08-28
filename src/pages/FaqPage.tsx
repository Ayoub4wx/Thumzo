import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";
import { buildAbsoluteUrl } from "../lib/siteMetadata";

const faqs = [
  {
    question: "What exactly does Thumora AI do?",
    answer: "Thumora AI is a thumbnail-first creator image studio. Instead of starting from scratch in Photoshop, you upload a base image, describe what you want, and the AI edits or generates a stronger result in seconds. It handles thumbnail generation, background cleanup, polish passes, upscaling, facial-expression swaps, and full concept redesigns."
  },
  {
    question: "How do credits work?",
    answer: "Every time you ask the AI to generate or edit an image, it costs 1 credit. Free Hobby users get a refill of credits every 30 days. Paid plans come with a larger monthly allowance, and you can buy one-time top-ups at any time if you run out."
  },
  {
    question: "Do I own the thumbnails I generate?",
    answer: "Yes. You have full commercial rights to use the thumbnails and creator images you generate for your channel or other projects, provided your original uploaded assets do not infringe on someone else's copyright."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Absolutely. You can cancel your subscription from the Billing settings page. You will keep your remaining credits and access to the paid features until the end of your current billing cycle."
  },
  {
    question: "Are my uploaded images private?",
    answer: "Yes, by default your images are private and are only used to process your specific generation requests. You can optionally opt-in to allow us to train our models on your data in the Privacy & Data settings."
  },
  {
    question: "What size are the exported thumbnails?",
    answer: "Thumbnail exports stay optimized for 1280x720 pixels (16:9), which is the recommended YouTube format. Creator utility workflows like polish and upscale keep working from that same studio flow."
  }
];

export default function FaqPage() {
  useDocumentMetadata({
    title: "AI Thumbnail Maker FAQ | Thumora AI",
    description: "Answers to common questions about the Thumora AI thumbnail maker, YouTube thumbnail workflows, credits, and commercial rights.",
    canonicalPath: "/faq",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
      url: buildAbsoluteUrl("/faq"),
    },
  });

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="relative min-h-screen pt-20 pb-24 overflow-hidden" dir="ltr">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent mb-4">FAQ</p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Everything you need to know about the product and billing.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            
            return (
              <div 
                key={index} 
                className={`rounded-[1.5rem] border transition-colors ${isOpen ? 'border-accent/50 bg-card/80' : 'border-border bg-card/40 hover:border-border/80'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-lg font-semibold text-foreground pr-8">{faq.question}</span>
                  <ChevronDown 
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : ''}`} 
                  />
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-0 text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
