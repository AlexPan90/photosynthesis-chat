"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible className={cn("group not-prose w-full", className)} {...props} />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

const statusColors: Record<ToolPart["state"], string> = {
  "approval-requested": "text-primary",
  "approval-responded": "text-primary",
  "input-available": "text-primary",
  "input-streaming": "text-muted-foreground",
  "output-available": "text-success",
  "output-denied": "text-destructive",
  "output-error": "text-destructive",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <ClockIcon className="size-3" />,
  "approval-responded": <CheckCircleIcon className="size-3" />,
  "input-available": <ClockIcon className="size-3 animate-pulse" />,
  "input-streaming": <CircleIcon className="size-3" />,
  "output-available": <CheckCircleIcon className="size-3" />,
  "output-denied": <XCircleIcon className="size-3" />,
  "output-error": <XCircleIcon className="size-3" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 text-[10.5px] font-medium tracking-wide",
      statusColors[status]
    )}
  >
    {statusIcons[status]}
    {statusLabels[status]}
  </span>
);

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  const quiet = state === "output-available";

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm py-1.5 text-left transition-colors hover:bg-foreground/[0.03]",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/60 transition-transform group-data-[state=closed]:-rotate-90" />
      <WrenchIcon className="size-3 shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 truncate text-[12px] text-muted-foreground">
        {title ?? derivedName}
      </span>
      {!quiet && (
        <span
          className={cn(
            "ml-0.5 inline-flex shrink-0 items-center gap-1 text-[10.5px]",
            statusColors[state]
          )}
        >
          {statusIcons[state]}
          {statusLabels[state]}
        </span>
      )}
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 space-y-2 pb-2 pl-[18px] pt-0.5 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1 overflow-hidden", className)} {...props}>
    <span className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/60">
      In
    </span>
    <div className="overflow-hidden rounded-md bg-muted/50 text-[11.5px] [&_pre]:!bg-transparent">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <span className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {errorText ? "Error" : "Out"}
      </span>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-[11.5px] [&_table]:w-full",
          errorText
            ? "bg-destructive/[0.06] px-2.5 py-2 text-destructive"
            : "bg-muted/50 text-foreground [&_pre]:!bg-transparent"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
