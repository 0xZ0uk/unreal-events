import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@events-tracker/ui/lib/utils";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-3 py-2 font-medium text-[14px] text-[var(--p443-ink)] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--p443-primary)] focus-visible:ring-2 focus-visible:ring-[var(--p443-primary)]/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
