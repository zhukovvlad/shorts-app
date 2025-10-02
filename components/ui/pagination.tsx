import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

/**
 * Renders a navigation container for pagination controls.
 *
 * @param className - Additional CSS class names to merge with the component's default classes.
 * @returns The rendered `nav` element configured for pagination with appropriate accessibility attributes.
 */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

/**
 * Container element for pagination items.
 *
 * Renders a <ul> with data-slot="pagination-content" and merges default layout classes with any provided `className`.
 *
 * @param className - Additional class names to apply to the list
 * @returns The pagination items list element
 */
function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
}

/**
 * Wrapper for an individual pagination item.
 *
 * Renders an `li` element exposed as the "pagination-item" slot and forwards all provided list-item props.
 *
 * @returns An `li` element with `data-slot="pagination-item"` and the forwarded props
 */
function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">

/**
 * Renders a styled anchor element for a pagination control.
 *
 * Applies an active presentation when `isActive` is true by setting `aria-current="page"` and a data attribute.
 *
 * @param isActive - Whether this link represents the current page; when true, sets `aria-current="page"` and an active visual style.
 * @param size - Button size variant to apply to the link (defaults to `"icon"`).
 * @param className - Additional CSS class names to merge with the component's computed classes.
 * @returns The anchor element configured as a pagination link.
 */
function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className
      )}
      {...props}
    />
  )
}

/**
 * Renders a "Previous" pagination link with a left chevron icon and a label that is hidden on small screens.
 *
 * @param props - Props passed to the underlying PaginationLink (including optional `className`).
 * @returns The pagination link element for navigating to the previous page.
 */
function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  )
}

/**
 * Renders a "Next" pagination link with a right chevron icon and a responsive label.
 *
 * @returns A pagination link element containing a right chevron icon and a "Next" label; the label is hidden on small screens and visible on larger screens.
 */
function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
      {...props}
    >
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  )
}

/**
 * Renders an accessible ellipsis used to indicate omitted pages in a pagination control.
 *
 * @returns A span element representing a pagination ellipsis, including a visual icon and screen-reader text
 */
function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
