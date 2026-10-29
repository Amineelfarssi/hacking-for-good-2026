import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

type TabsVariant = "pill" | "underline"

// The list tells its triggers which look to use, so a caller sets the variant
// once on <TabsList> instead of on every <TabsTrigger>.
const TabsVariantContext = React.createContext<TabsVariant>("pill")

const tabsListVariants: Record<TabsVariant, string> = {
  pill: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
  // A row of labels on a hairline, the current one underlined in ink. Scrolls
  // sideways on narrow screens instead of wrapping.
  underline:
    "flex w-full items-center gap-1 overflow-x-auto border-b border-border text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
}

const tabsTriggerVariants: Record<TabsVariant, string> = {
  pill: "rounded-sm px-3 py-1.5 font-medium ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  underline:
    "-mb-px shrink-0 border-b-2 border-transparent px-3 pb-2 pt-1 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:font-medium data-[state=active]:text-foreground",
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: TabsVariant
  }
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants[variant], className)}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap text-sm transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        tabsTriggerVariants[variant],
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
