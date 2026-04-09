import { Check } from "lucide-react";
import { motion } from "motion/react";

const tiers = [
  {
    name: "Free",
    price: "0",
    description: "For beginner content creators",
    features: [
      "5 generations per day",
      "Standard quality",
      "Light watermark",
      "Community support",
    ],
    buttonText: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "12",
    description: "For professionals and growth",
    features: [
      "Unlimited generations",
      "4K Ultra quality",
      "No watermark",
      "Priority support",
      "Early access to features",
    ],
    buttonText: "Subscribe Now",
    highlight: true,
  },
  {
    name: "Yearly",
    price: "96",
    description: "Best value for creators",
    features: [
      "All Pro features",
      "Save 33%",
      "Dedicated support",
      "Free consultation session",
    ],
    buttonText: "Save Now",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-24 px-4" dir="ltr">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Plans that fit your ambition</h2>
          <p className="text-muted-foreground text-lg">Choose the right plan for your channel and start attracting more viewers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl border ${
                tier.highlight
                  ? "bg-accent/5 border-accent shadow-[0_0_40px_rgba(255,77,28,0.1)]"
                  : "bg-card border-border"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-4 py-1 rounded-full text-sm font-bold">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{tier.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-4 rounded-xl font-bold transition-all ${
                  tier.highlight
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {tier.buttonText}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
