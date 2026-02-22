import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X } from "lucide-react";

interface AIAnalysisPanelProps {
  title: string;
  result: string;
  isLoading: boolean;
  onClose: () => void;
}

export function AIAnalysisPanel({ title, result, isLoading, onClose }: AIAnalysisPanelProps) {
  if (!result && !isLoading) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && !result && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando com IA...
          </div>
        )}
        {result && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{result}</ReactMarkdown>
          </div>
        )}
        {isLoading && result && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Gerando...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
