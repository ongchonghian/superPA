import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
           <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary"
            >
              <path d="M7 10v4h10v-4" />
              <path d="M10.5 10V7.5a1.5 1.5 0 0 1 3 0V10" />
              <path d="M17 14v2.5a1.5 1.5 0 0 1-3 0V14" />
              <path d="M2 12s.5-5 5-5 5 5 5 5" />
              <path d="M22 12s-.5 5-5 5-5-5-5-5" />
            </svg>
            <h1 className="text-2xl font-headline font-bold text-foreground">Super PA</h1>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing your workspace...</p>
      </div>
    </div>
  );
}
