import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@events-tracker/ui/lib/utils";

const badgeVariants = cva(
	"group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[12px] font-semibold tracking-wide whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
	{
		variants: {
			variant: {
				default:
					"bg-[var(--arc-ink)] text-[var(--arc-canvas)] [a]:hover:bg-[var(--arc-primary-dark)]",
				secondary:
					"bg-[var(--arc-surface-students-grey)] text-[var(--arc-ink-students)] [a]:hover:bg-[var(--arc-surface-students-hover)]",
				students:
					"bg-[var(--arc-surface-students-grey)] text-[var(--arc-ink-students)] rounded-full",
				blue: "bg-[var(--arc-primary)] text-white",
				pinkish: "bg-[var(--arc-students-pinkish)] text-white",
				salmon:
					"bg-[var(--arc-students-salmon)] text-[var(--arc-ink-students)]",
				outline:
					"border-[var(--arc-ink)]/15 text-[var(--arc-ink-muted)] bg-transparent [a]:hover:bg-muted [a]:hover:text-muted-foreground",
				ghost:
					"hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
				destructive:
					"bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
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
