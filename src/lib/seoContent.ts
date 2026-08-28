export interface FaqItem {
  question: string;
  answer: string;
}

export interface TutorialContent {
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  watchSummary: string;
  videoUrl: string;
  bestFor: string[];
  steps: Array<{
    title: string;
    description: string;
  }>;
  faq: FaqItem[];
  relatedLinks: Array<{
    label: string;
    path: string;
  }>;
}

export interface UseCaseContent {
  slug: string;
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  intro: string;
  highlights: string[];
  workflow: Array<{
    title: string;
    description: string;
  }>;
  faq: FaqItem[];
  relatedLinks: Array<{
    label: string;
    path: string;
  }>;
}

const insertMeVideoUrl =
  "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/logos%20company/0420.mp4";
const youtubeUrlVideoUrl =
  "https://fncjyuuxqpnydgnugmqz.supabase.co/storage/v1/object/public/logos%20company/0420%20(1).mp4";

export const tutorialLibrary: TutorialContent[] = [
  {
    slug: "insert-me-thumbnail",
    path: "/tutorials/insert-me-thumbnail",
    title: "How to Put Yourself Into a Thumbnail",
    seoTitle: "How to Put Yourself Into a Thumbnail | Thumora AI Tutorial",
    description:
      "Learn how to replace the subject in an existing YouTube thumbnail with your own photo using the Thumora AI Insert Me workflow.",
    intro:
      "Use this workflow when the concept already works and the main job is swapping the subject for your own face or reference photo without rebuilding the whole thumbnail.",
    watchSummary:
      "This walkthrough shows how creators start from an existing thumbnail, open Insert Me, upload a reference, and compare the new frame before saving.",
    videoUrl: insertMeVideoUrl,
    bestFor: ["Thumbnail remakes", "Personal branding", "Fast subject swaps"],
    steps: [
      {
        title: "Open an existing thumbnail or draft",
        description: "Start from a layout that already has the right framing, text, and visual hook.",
      },
      {
        title: "Choose Insert Me inside Studio",
        description: "Use the Insert Me action when the scene works but the person in the thumbnail needs to change.",
      },
      {
        title: "Upload a clear reference photo",
        description: "A front-facing, well-lit photo gives the model a better anchor for facial similarity and expression.",
      },
      {
        title: "Generate, compare, and keep iterating",
        description: "Compare the new version against the original and run another pass if the pose, crop, or expression needs work.",
      },
    ],
    faq: [
      {
        question: "When should I use Insert Me instead of starting from blank?",
        answer:
          "Use Insert Me when the composition already works and you only need to replace the person or subject. Start from blank when the whole concept still needs to be built.",
      },
      {
        question: "What kind of reference image works best?",
        answer:
          "A clean, well-lit image with a clear face and simple framing works best. Strong motion blur, sunglasses, or very small faces usually reduce accuracy.",
      },
      {
        question: "Can I use this after importing a thumbnail from YouTube?",
        answer:
          "Yes. A common workflow is importing a live thumbnail first, then using Insert Me to swap the subject and keep the rest of the design direction.",
      },
    ],
    relatedLinks: [
      { label: "AI thumbnail remaker", path: "/ai-thumbnail-remaker" },
      { label: "Thumbnail maker from YouTube URL", path: "/thumbnail-maker-from-youtube-url" },
      { label: "All tutorials", path: "/tutorials" },
    ],
  },
  {
    slug: "youtube-url-thumbnail-import",
    path: "/tutorials/youtube-url-thumbnail-import",
    title: "How to Import a Thumbnail From a YouTube URL",
    seoTitle: "How to Import a Thumbnail From a YouTube URL | Thumora AI Tutorial",
    description:
      "Learn how to paste a YouTube URL into Thumora AI, pull the live thumbnail into Studio, and start editing from a real YouTube video.",
    intro:
      "Use this flow when the thumbnail already exists on YouTube and you want to iterate on the live version instead of downloading files by hand.",
    watchSummary:
      "This walkthrough covers copying the link, importing the existing thumbnail from the video URL, and opening it inside Studio for a remake or edit.",
    videoUrl: youtubeUrlVideoUrl,
    bestFor: ["YouTube imports", "Fast remakes", "Editing live thumbnails"],
    steps: [
      {
        title: "Copy the public YouTube link",
        description: "Start from the video that already has the thumbnail you want to edit or reuse.",
      },
      {
        title: "Paste the URL into the import flow",
        description: "Thumora extracts the video thumbnail so you can skip manual downloads and local file cleanup.",
      },
      {
        title: "Open the imported image in Studio",
        description: "Use the live thumbnail as the starting point for edits, remakes, subject swaps, or polish passes.",
      },
      {
        title: "Save a new version after your changes",
        description: "Keep iterating inside Studio until the imported concept becomes a stronger thumbnail for your next upload.",
      },
    ],
    faq: [
      {
        question: "Why use a YouTube URL instead of downloading the thumbnail manually?",
        answer:
          "The URL flow is faster and keeps the workflow inside the editor. It removes extra steps before you start the actual thumbnail work.",
      },
      {
        question: "Can I use the imported thumbnail as the base for a remake?",
        answer:
          "Yes. That is one of the main reasons to use this workflow. Import first, then edit, remake, or swap the subject inside Studio.",
      },
      {
        question: "Does this change the live YouTube thumbnail automatically?",
        answer:
          "No. This workflow is read-only on the YouTube side. It imports the current image into Thumora, but publishing remains your choice.",
      },
    ],
    relatedLinks: [
      { label: "Thumbnail maker from YouTube URL", path: "/thumbnail-maker-from-youtube-url" },
      { label: "YouTube thumbnail maker", path: "/youtube-thumbnail-maker" },
      { label: "All tutorials", path: "/tutorials" },
    ],
  },
];

export const useCaseLibrary: UseCaseContent[] = [
  {
    slug: "youtube-thumbnail-maker",
    path: "/youtube-thumbnail-maker",
    title: "YouTube Thumbnail Maker",
    seoTitle: "YouTube Thumbnail Maker for Creator Workflows | Thumora AI",
    description:
      "Use Thumora AI as a YouTube thumbnail maker for faster remakes, subject swaps, reference-image edits, and thumbnail iteration built around creator workflows.",
    intro:
      "This page is for creators who need a thumbnail maker built around YouTube jobs, not a generic image generator that starts from scratch every time.",
    highlights: [
      "Start from blank ideas or existing thumbnails",
      "Import a live thumbnail from a YouTube URL",
      "Swap the subject with Insert Me when the concept already works",
      "Move from rough concept to publish-ready variation inside Studio",
    ],
    workflow: [
      {
        title: "Start from the thumbnail job you actually have",
        description: "Open Studio for a new concept, import an existing thumbnail, or bring in a reference image from a creator asset you already use.",
      },
      {
        title: "Improve the click-driving parts first",
        description: "Focus on subject clarity, contrast, emotional framing, and the core promise before you fine-tune small visual details.",
      },
      {
        title: "Iterate until the thumbnail feels publishable",
        description: "Use quick passes and variations instead of rebuilding the whole thing from zero every time you want a stronger version.",
      },
    ],
    faq: [
      {
        question: "Can I use this YouTube thumbnail maker with an existing thumbnail?",
        answer:
          "Yes. Thumora works well when you already have a live thumbnail and want to remake, clean up, or reframe it without starting over.",
      },
      {
        question: "Is this only for new thumbnails?",
        answer:
          "No. The strongest creator workflows are usually remakes, imports, and subject swaps, not just blank-canvas generation.",
      },
      {
        question: "What is the fastest way to start if I already have a video published?",
        answer:
          "Use the YouTube URL import workflow, pull the live thumbnail into Studio, and start from the current version.",
      },
    ],
    relatedLinks: [
      { label: "Tutorial: import from a YouTube URL", path: "/tutorials/youtube-url-thumbnail-import" },
      { label: "AI thumbnail remaker", path: "/ai-thumbnail-remaker" },
      { label: "Thumbnail ideas for YouTube", path: "/thumbnail-ideas-for-youtube" },
    ],
  },
  {
    slug: "ai-thumbnail-remaker",
    path: "/ai-thumbnail-remaker",
    title: "AI Thumbnail Remaker",
    seoTitle: "AI Thumbnail Remaker for Existing YouTube Thumbnails | Thumora AI",
    description:
      "Use Thumora AI as an AI thumbnail remaker when you already have a thumbnail concept and want a stronger version without rebuilding everything from scratch.",
    intro:
      "A thumbnail remaker is most useful when the original idea is close, but the execution is weak. That is the gap this workflow is built for.",
    highlights: [
      "Start from an existing thumbnail instead of a blank prompt",
      "Keep the original hook while improving the visual execution",
      "Swap the subject, crop, or emphasis without losing the concept",
      "Create another version quickly when the first pass still feels soft",
    ],
    workflow: [
      {
        title: "Import or upload the current thumbnail",
        description: "Bring in the original version so the remake starts from the exact idea already tied to the video.",
      },
      {
        title: "Decide what should stay and what should change",
        description: "Keep the proven hook, but improve the weak part such as the subject, clarity, contrast, or emotional framing.",
      },
      {
        title: "Generate the remake and compare it side by side",
        description: "A remake is only useful when the new version is clearly stronger. Use fast iterations until the difference is obvious.",
      },
    ],
    faq: [
      {
        question: "What is the difference between a thumbnail remaker and a thumbnail maker?",
        answer:
          "A thumbnail maker can start from blank. A thumbnail remaker starts from a real thumbnail that already exists and pushes it into a stronger version.",
      },
      {
        question: "Can I replace the person in the original thumbnail?",
        answer:
          "Yes. Insert Me is one of the cleanest ways to remake a thumbnail while keeping the original scene direction intact.",
      },
      {
        question: "Why remake instead of generating a completely new idea?",
        answer:
          "Because many thumbnails fail on execution, not on concept. A remake lets you keep the useful part and fix what is dragging the click appeal down.",
      },
    ],
    relatedLinks: [
      { label: "Tutorial: put yourself into a thumbnail", path: "/tutorials/insert-me-thumbnail" },
      { label: "YouTube thumbnail maker", path: "/youtube-thumbnail-maker" },
      { label: "Thumbnail maker from YouTube URL", path: "/thumbnail-maker-from-youtube-url" },
    ],
  },
  {
    slug: "thumbnail-ideas-for-youtube",
    path: "/thumbnail-ideas-for-youtube",
    title: "Thumbnail Ideas for YouTube",
    seoTitle: "Thumbnail Ideas for YouTube Videos | Thumora AI",
    description:
      "Generate thumbnail ideas for YouTube videos, then turn the strongest hook into a real thumbnail inside Thumora AI.",
    intro:
      "Creators usually do not need more random images. They need better thumbnail angles before they start designing. This page is built around that job.",
    highlights: [
      "Turn a topic into multiple thumbnail angles",
      "Compare hooks before you commit to one direction",
      "Move from idea generation into Studio without leaving the workflow",
      "Use the final idea as the base for a thumbnail remake or fresh design",
    ],
    workflow: [
      {
        title: "Start with the video topic or promise",
        description: "A thumbnail idea is stronger when it is tied to the exact promise the video is making, not just the broad topic.",
      },
      {
        title: "Generate several visual hooks",
        description: "Compare multiple angles so you can see which one actually creates tension, curiosity, contrast, or emotional pull.",
      },
      {
        title: "Build the best angle into a thumbnail",
        description: "Once the idea is clear, take it into Studio and turn that hook into the actual thumbnail frame you plan to publish.",
      },
    ],
    faq: [
      {
        question: "What makes a strong YouTube thumbnail idea?",
        answer:
          "A strong idea makes the core promise obvious in one frame. It usually has one dominant subject, one clear emotion or tension point, and one visual reason to click.",
      },
      {
        question: "Should I generate several thumbnail ideas before I design?",
        answer:
          "Yes. It is usually faster to compare a few angles early than to spend time polishing a weak direction.",
      },
      {
        question: "Can I use the final idea inside the editor?",
        answer:
          "Yes. The point of this workflow is moving from idea to execution without losing momentum between the two steps.",
      },
    ],
    relatedLinks: [
      { label: "YouTube thumbnail maker", path: "/youtube-thumbnail-maker" },
      { label: "AI thumbnail remaker", path: "/ai-thumbnail-remaker" },
      { label: "Tutorials", path: "/tutorials" },
    ],
  },
  {
    slug: "thumbnail-maker-from-youtube-url",
    path: "/thumbnail-maker-from-youtube-url",
    title: "Thumbnail Maker From a YouTube URL",
    seoTitle: "Thumbnail Maker From a YouTube URL | Thumora AI",
    description:
      "Use a YouTube video link to pull an existing thumbnail into Thumora AI, then edit or remake it from the live version instead of downloading files manually.",
    intro:
      "This is the cleanest page for creators searching for a thumbnail maker from a YouTube URL because the whole workflow starts with the live video link.",
    highlights: [
      "Paste the video URL and start from the live thumbnail",
      "Skip the download-and-upload loop before editing",
      "Use the imported frame as the base for a remake or subject swap",
      "Keep everything inside the editor once the thumbnail is pulled in",
    ],
    workflow: [
      {
        title: "Copy the YouTube video URL",
        description: "Use the exact public video link for the thumbnail you want to bring into the editor.",
      },
      {
        title: "Import the live thumbnail into Studio",
        description: "Thumora turns that URL into an editable starting point so you can work from the actual thumbnail already attached to the video.",
      },
      {
        title: "Edit, remake, or swap the subject",
        description: "Once the frame is inside Studio, you can keep iterating the same way you would with any other thumbnail project.",
      },
    ],
    faq: [
      {
        question: "Why is a YouTube URL workflow useful?",
        answer:
          "Because many creators want to improve a thumbnail that already exists on a live video. Starting from the URL is faster than manually exporting and cleaning up the file first.",
      },
      {
        question: "Can I use this for remakes?",
        answer:
          "Yes. This workflow is one of the best starting points for remaking an existing thumbnail while keeping the original concept nearby.",
      },
      {
        question: "Does importing from a URL publish the new thumbnail back to YouTube?",
        answer:
          "No. The import is read-only. You bring the thumbnail into Thumora, make your edits, and decide separately how you want to publish the final image.",
      },
    ],
    relatedLinks: [
      { label: "Tutorial: import from a YouTube URL", path: "/tutorials/youtube-url-thumbnail-import" },
      { label: "YouTube thumbnail maker", path: "/youtube-thumbnail-maker" },
      { label: "AI thumbnail remaker", path: "/ai-thumbnail-remaker" },
    ],
  },
];

export function getTutorialBySlug(slug: string) {
  return tutorialLibrary.find((item) => item.slug === slug) || null;
}

export function getUseCaseBySlug(slug: string) {
  return useCaseLibrary.find((item) => item.slug === slug) || null;
}
