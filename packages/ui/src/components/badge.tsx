import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@events-tracker/ui/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border border-transparent px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.4px] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				/* Status chip: dark surface + muted ink (DESIGN.md status-chip) */
				default:
					"bg-[var(--p443-surface)] text-[var(--p443-ink-muted)] border border-[var(--p443-hairline)]",
				secondary:
					"bg-[var(--p443-surface)] text-[var(--p443-ink-muted)] border border-[var(--p443-hairline)]",
				/* Amber reserved — use sparingly (one per view) */
				blue: "bg-[var(--p443-primary)] text-[var(--p443-on-primary)]",
				pinkish:
					"bg-destructive/15 text-destructive",
				salmon:
					"bg-[var(--p443-surface)] text-[var(--p443-ink-muted)] border border-[var(--p443-hairline)]",
				students:
					"bg-[var(--p443-surface)] text-[var(--p443-ink-muted)] border border-[var(--p443-hairline)]",
				outline:
					"border-[var(--p443-hairline)] text-[var(--p443-ink-muted)] bg-transparent",
				ghost:
					"hover:bg-muted hover:text-muted-foreground",
				destructive:
					"bg-destructive/10 text-destructive focus-visible:ring-destructive/20",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
