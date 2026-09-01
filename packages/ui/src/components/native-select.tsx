import * as React from "react";

import { cn } from "@events-tracker/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
	size?: "sm" | "default";
};

function NativeSelect({
	className,
	size = "default",
	...props
}: NativeSelectProps) {
	return (
		<div
			className={cn(
				"group/native-select relative w-fit has-[select:disabled]:opacity-50",
				className,
			)}
			data-slot="native-select-wrapper"
			data-size={size}
		>
			<select
				data-slot="native-select"
				data-size={size}
				className="h-9 w-full min-w-0 appearance-none rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] py-1 pr-8 pl-3 text-sm font-medium text-[var(--p443-ink)] transition-colors outline-none select-none focus-visible:border-[var(--p443-primary)] focus-visible:ring-2 focus-visible:ring-[var(--p443-primary)]/30 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[size=sm]:h-8 data-[size=sm]:rounded-[2px] data-[size=sm]:py-0.5 hover:border-[var(--p443-ink-muted)]"
				{...props}
			/>
			<ChevronDownIcon
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
				aria-hidden="true"
				data-slot="native-select-icon"
			/>
		</div>
	);
}

function NativeSelectOption({
	className,
	...props
}: React.ComponentProps<"option">) {
	return (
		<option
			data-slot="native-select-option"
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			{...props}
		/>
	);
}

function NativeSelectOptGroup({
	className,
	...props
}: React.ComponentProps<"optgroup">) {
	return (
		<optgroup
			data-slot="native-select-optgroup"
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			{...props}
		/>
	);
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
