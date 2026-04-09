import { motion } from "motion/react";
import { Code, Terminal, Cpu, Globe, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function ApiDocsPage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeExample = `curl -X POST https://thumio.ai/api/v1/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Cyberpunk city at night, neon lights",
    "aspectRatio": "16:9",
    "quality": "4K"
  }'`;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
        <p className="text-muted-foreground text-lg">
          Integrate Thumio's powerful thumbnail generation into your own applications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-card border border-border rounded-3xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Terminal className="w-6 h-6 text-accent" />
              Authentication
            </h2>
            <p className="text-muted-foreground mb-4">
              All API requests must include your API key in the <code className="text-accent bg-accent/10 px-2 py-0.5 rounded">Authorization</code> header.
            </p>
            <div className="bg-muted/50 rounded-xl p-4 font-mono text-sm text-muted-foreground border border-border">
              Authorization: Bearer th_live_xxxxxxxxxxxx
            </div>
          </section>

          <section className="bg-card border border-border rounded-3xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-accent" />
              Generate Thumbnail
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">POST</span>
                <code className="text-sm">/api/v1/generate</code>
              </div>
              <p className="text-muted-foreground">
                Generate a new thumbnail based on a text prompt and optional configuration.
              </p>
              
              <h3 className="font-bold mt-6 mb-2">Parameters</h3>
              <table className="w-full text-sm text-left">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  <tr>
                    <td className="py-3 font-mono text-accent">prompt</td>
                    <td className="py-3">string</td>
                    <td className="py-3">The visual description of the thumbnail.</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-mono text-accent">aspectRatio</td>
                    <td className="py-3">string</td>
                    <td className="py-3">16:9, 9:16, or 1:1.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-accent/10 border border-accent/20 rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-accent" />
              Quick Start
            </h3>
            <div className="relative group">
              <pre className="bg-muted/50 p-4 rounded-xl text-xs font-mono text-muted-foreground overflow-x-auto">
                {codeExample}
              </pre>
              <button 
                onClick={() => copyToClipboard(codeExample)}
                className="absolute top-2 right-2 p-2 bg-muted hover:bg-muted-foreground/20 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent" />
              Rate Limits
            </h3>
            <p className="text-sm text-muted-foreground">
              Free accounts are limited to 10 requests per minute. Pro accounts enjoy up to 100 requests per minute.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
