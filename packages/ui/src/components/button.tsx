import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "@events-tracker/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center rounded-[8px] border border-transparent bg-clip-padding text-[14px] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-[var(--arc-primary-dark)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
				arc: "bg-[var(--arc-ink)] text-[var(--arc-canvas)] hover:bg-[var(--arc-primary-dark)] rounded-[22px] h-[52px] px-[22px] text-[15px] font-medium shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
				"arc-cta":
					"bg-[var(--arc-ink)] text-[var(--arc-canvas)] hover:bg-[var(--arc-primary-dark)] rounded-[22px] h-[76px] px-[22px] pr-[8px] text-[20px] font-normal shadow-[0_8px_30px_rgba(0,0,0,0.12)] gap-3",
				outline:
					"border border-[var(--arc-ink)] bg-[var(--arc-canvas)] text-[var(--arc-ink)] hover:bg-[var(--arc-surface-students)] rounded-[8px] aria-expanded:bg-muted aria-expanded:text-foreground",
				secondary:
					"bg-[var(--arc-surface-students-grey)] text-[var(--arc-ink-students)] hover:bg-[var(--arc-surface-students-hover)] rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase",
				ghost:
					"hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 rounded-[8px]",
				destructive:
					"bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
				link: "text-[var(--arc-primary)] underline-offset-4 hover:underline",
				blue: "bg-[var(--arc-primary)] text-[var(--arc-canvas)] hover:bg-[var(--arc-primary-deep)] rounded-[8px] shadow-sm",
			},
			size: {
				default:
					"h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
				xs: "h-6 gap-1 rounded-full px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-[8px] px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-10 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
				cta: "h-[76px] gap-3 rounded-[22px] px-[22px] pr-[8px] text-[20px]",
				icon: "size-9 rounded-[8px]",
				"icon-xs":
					"size-7 rounded-[8px] [&_svg:not([class*='size-'])]:size-3.5",
				"icon-sm": "size-8 rounded-[8px]",
				"icon-lg": "size-10 rounded-[12px]",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
