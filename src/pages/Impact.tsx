import { Link } from "react-router-dom";
import { Check, X, AlertTriangle, Mail } from "lucide-react";

interface ComparisonItem {
  criteria: string;
  ats: { value: string; status: "bad" | "warning" | "neutral" };
  chatgpt: { value: string; status: "bad" | "warning" | "neutral" };
  provaluate: { value: string; status: "good" };
}

const comparisonData: ComparisonItem[] = [
  {
    criteria: "JD Understanding",
    ats: { value: "Keyword-based parsing", status: "neutral" },
    chatgpt: { value: "Contextual, but unstructured", status: "warning" },
    provaluate: { value: "Resolved & structured JD first", status: "good" },
  },
  {
    criteria: "CV Assessment",
    ats: { value: "Keyword match %", status: "neutral" },
    chatgpt: { value: "Narrative comparison", status: "warning" },
    provaluate: { value: "Structured, criteria-based evaluation", status: "good" },
  },
  {
    criteria: "Handles JD Ambiguity",
    ats: { value: "No", status: "bad" },
    chatgpt: { value: "Partially", status: "warning" },
    provaluate: { value: "Yes (core design principle)", status: "good" },
  },
  {
    criteria: "Risk of Hallucination",
    ats: { value: "Low (but shallow)", status: "neutral" },
    chatgpt: { value: "Medium–High", status: "warning" },
    provaluate: { value: "Curtailed via saved JD context", status: "good" },
  },
  {
    criteria: "Evaluation Consistency",
    ats: { value: "Medium", status: "neutral" },
    chatgpt: { value: "Low (prompt dependent)", status: "warning" },
    provaluate: { value: "High & repeatable", status: "good" },
  },
  {
    criteria: "Interview Capability",
    ats: { value: "None", status: "bad" },
    chatgpt: { value: "Static Q&A", status: "warning" },
    provaluate: { value: "Dynamic, depth-probing interviews", status: "good" },
  },
  {
    criteria: "Depth of Assessment",
    ats: { value: "Surface-level", status: "neutral" },
    chatgpt: { value: "Depends on prompt", status: "warning" },
    provaluate: { value: "Designed for depth by default", status: "good" },
  },
  {
    criteria: "Bias Reduction",
    ats: { value: "Limited", status: "neutral" },
    chatgpt: { value: "Unpredictable", status: "warning" },
    provaluate: { value: "Structured & explainable", status: "good" },
  },
  {
    criteria: "Explainable Scores",
    ats: { value: "Limited", status: "neutral" },
    chatgpt: { value: "No", status: "bad" },
    provaluate: { value: "Yes", status: "good" },
  },
  {
    criteria: "Enterprise Readiness",
    ats: { value: "Yes", status: "neutral" },
    chatgpt: { value: "No", status: "bad" },
    provaluate: { value: "Yes", status: "good" },
  },
];

const StatusIcon = ({ status }: { status: "good" | "bad" | "warning" | "neutral" }) => {
  if (status === "good") {
    return <Check className="w-4 h-4 text-success inline mr-1.5" />;
  }
  if (status === "bad") {
    return <X className="w-4 h-4 text-destructive inline mr-1.5" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="w-4 h-4 text-warning inline mr-1.5" />;
  }
  return null;
};

const Impact = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div>
                <img src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`} alt="ProValuate" className="h-12 sm:h-16 lg:h-20" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="font-medium text-[#0d6ea3] hover:text-[#042C53] transition-colors">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section id="comparison" className="py-16 sm:py-20 lg:py-24 bg-background rounded-2xl">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                Three ways to assess candidates.{" "}
                <span className="text-gradient">Very different outcomes.</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                See how ProValuate compares to traditional ATS and generic AI solutions.
              </p>
            </div>

            <div className="md:hidden space-y-4">
              {comparisonData.map((row) => (
                <div key={row.criteria} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border bg-muted/30">
                    <div className="text-sm font-semibold text-foreground">{row.criteria}</div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-xs font-medium text-muted-foreground">Traditional ATS</div>
                      <div className="text-right text-sm text-muted-foreground">
                        <StatusIcon status={row.ats.status} />
                        <span className={row.ats.status === "bad" ? "text-destructive" : ""}>{row.ats.value}</span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="text-xs font-medium text-muted-foreground">ChatGPT / Generic LLM</div>
                      <div className="text-right text-sm text-muted-foreground">
                        <StatusIcon status={row.chatgpt.status} />
                        <span
                          className={
                            row.chatgpt.status === "bad"
                              ? "text-destructive"
                              : row.chatgpt.status === "warning"
                                ? "text-warning"
                                : ""
                          }
                        >
                          {row.chatgpt.value}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4 rounded-xl bg-primary/5 px-3 py-3">
                      <div className="text-xs font-medium text-muted-foreground">ProValuate</div>
                      <div className="text-right text-sm">
                        <StatusIcon status={row.provaluate.status} />
                        <span className="text-success font-semibold">{row.provaluate.value}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto rounded-2xl border border-border shadow-card bg-card">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-4 px-6 font-semibold text-foreground border-b border-border">
                      Criteria
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground border-b border-border">
                      Traditional ATS
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground border-b border-border">
                      ChatGPT / Generic LLM
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-primary border-b border-border bg-primary/5">
                      ProValuate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr key={row.criteria} className={index % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                      <td className="py-4 px-6 font-medium text-foreground border-b border-border/50">
                        {row.criteria}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground border-b border-border/50">
                        <StatusIcon status={row.ats.status} />
                        <span className={row.ats.status === "bad" ? "text-destructive" : ""}>
                          {row.ats.value}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-muted-foreground border-b border-border/50">
                        <StatusIcon status={row.chatgpt.status} />
                        <span
                          className={
                            row.chatgpt.status === "bad"
                              ? "text-destructive"
                              : row.chatgpt.status === "warning"
                                ? "text-warning"
                                : ""
                          }
                        >
                          {row.chatgpt.value}
                        </span>
                      </td>
                      <td className="py-4 px-6 border-b border-border/50 bg-primary/5">
                        <StatusIcon status={row.provaluate.status} />
                        <span className="text-success font-medium">{row.provaluate.value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mt-10 text-center">
              <div>
                <span className="text-lg font-semibold text-muted-foreground">ATS filters.</span>
              </div>
              <div>
                <span className="text-lg font-semibold text-muted-foreground">ChatGPT reasons.</span>
              </div>
              <div>
                <span className="text-lg font-bold text-primary">ProValuate verifies.</span>
              </div>
            </div>
            <p className="mt-8 text-center text-lg sm:text-xl text-black font-medium">
              Want to know more about how we assess candidates and solve hiring problems?{" "}
              <a
                href="https://aitamate.com/provaluate-blog.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0d6ea3] font-semibold underline hover:text-[#042C53]"
              >
                Click here
              </a>{" "}
              to understand the workflow.
            </p>
          </div>
        </section>

        <div className="mt-16 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <p className="text-gray-600 mb-4">
              We're here to help! Our team is ready to answer any questions about our plans and features.
            </p>
            <a
              href="mailto:sales@aitamate.com?subject=ProValuate%20Pricing%20Inquiry"
              className="inline-flex items-center space-x-2 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-[0_4px_18px_rgba(13,110,163,0.28)] hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <Mail className="h-5 w-5" />
              <span>Contact Sales</span>
            </a>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>© 2025 ProValuate. All rights reserved.</p>
            <p className="text-sm mt-2">
              AI-powered resume evaluation and job matching platform for recruiters
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-4 text-sm">
              <Link to="/privacy" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Privacy Policy</Link>
              <span>|</span>
              <Link to="/terms" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Terms</Link>
              <span>|</span>
              <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Impact;
