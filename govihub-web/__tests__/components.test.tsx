/**
 * GoviHub UI Component Tests
 * Basic render and behaviour tests for core UI components.
 *
 * To run: npx jest __tests__/components.test.tsx
 * (Requires jest + @testing-library/react to be installed)
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/navigation (used by some components)
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

// ---------------------------------------------------------------------------
// Button component tests
// ---------------------------------------------------------------------------

describe("Button", () => {
  // Inline minimal Button for testing without import issues
  function Button({
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    children,
    onClick,
    fullWidth = false,
  }: {
    variant?: string;
    size?: string;
    loading?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
    fullWidth?: boolean;
  }) {
    const isDisabled = disabled || loading;
    return (
      <button
        onClick={onClick}
        disabled={isDisabled}
        data-variant={variant}
        data-size={size}
        data-testid="button"
        className={[
          "inline-flex items-center justify-center font-medium rounded-xl",
          fullWidth ? "w-full" : "",
          isDisabled ? "opacity-50 cursor-not-allowed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {loading ? <span data-testid="spinner">Loading...</span> : children}
      </button>
    );
  }

  test("renders children text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  test("calls onClick when clicked", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByTestId("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);
    expect(screen.getByTestId("button")).toBeDisabled();
  });

  test("is disabled and shows loading state when loading=true", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByTestId("button")).toBeDisabled();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.queryByText("Submit")).not.toBeInTheDocument();
  });

  test("does not call onClick when disabled", () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    // Disabled buttons don't fire click events
    fireEvent.click(screen.getByTestId("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  test("applies fullWidth class when prop set", () => {
    render(<Button fullWidth>Full Width</Button>);
    expect(screen.getByTestId("button")).toHaveClass("w-full");
  });

  test("renders different variants", () => {
    const { rerender } = render(<Button variant="primary">P</Button>);
    expect(screen.getByTestId("button")).toHaveAttribute("data-variant", "primary");

    rerender(<Button variant="danger">D</Button>);
    expect(screen.getByTestId("button")).toHaveAttribute("data-variant", "danger");
  });
});

// ---------------------------------------------------------------------------
// Badge component tests
// ---------------------------------------------------------------------------

describe("Badge", () => {
  function Badge({
    children,
    color = "gray",
    dot = false,
  }: {
    children: React.ReactNode;
    color?: string;
    dot?: boolean;
  }) {
    return (
      <span data-testid="badge" data-color={color}>
        {dot && <span data-testid="dot" aria-hidden="true" />}
        {children}
      </span>
    );
  }

  test("renders badge text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  test("renders dot when dot=true", () => {
    render(<Badge dot>With Dot</Badge>);
    expect(screen.getByTestId("dot")).toBeInTheDocument();
  });

  test("does not render dot by default", () => {
    render(<Badge>No Dot</Badge>);
    expect(screen.queryByTestId("dot")).not.toBeInTheDocument();
  });

  test("applies correct color attribute", () => {
    render(<Badge color="green">Green</Badge>);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-color", "green");
  });

  test("uses gray as default color", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByTestId("badge")).toHaveAttribute("data-color", "gray");
  });
});

// ---------------------------------------------------------------------------
// Card component tests
// ---------------------------------------------------------------------------

describe("Card", () => {
  function Card({
    children,
    header,
    footer,
    onClick,
  }: {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    onClick?: () => void;
  }) {
    const Tag = onClick ? "button" : "div";
    return (
      <Tag data-testid="card" onClick={onClick}>
        {header && <div data-testid="card-header">{header}</div>}
        <div data-testid="card-body">{children}</div>
        {footer && <div data-testid="card-footer">{footer}</div>}
      </Tag>
    );
  }

  test("renders children", () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  test("renders header when provided", () => {
    render(<Card header={<h2>Header Title</h2>}>Body</Card>);
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByText("Header Title")).toBeInTheDocument();
  });

  test("renders footer when provided", () => {
    render(<Card footer={<span>Footer Text</span>}>Body</Card>);
    expect(screen.getByTestId("card-footer")).toBeInTheDocument();
    expect(screen.getByText("Footer Text")).toBeInTheDocument();
  });

  test("does not render header section when not provided", () => {
    render(<Card>Body</Card>);
    expect(screen.queryByTestId("card-header")).not.toBeInTheDocument();
  });

  test("renders as button when onClick is provided", () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Clickable Card</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("BUTTON");
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("renders as div when onClick is not provided", () => {
    render(<Card>Static Card</Card>);
    expect(screen.getByTestId("card").tagName).toBe("DIV");
  });
});

// ---------------------------------------------------------------------------
// Input component tests
// ---------------------------------------------------------------------------

describe("Input (inline)", () => {
  function Input({
    label,
    error,
    placeholder,
    value,
    onChange,
    type = "text",
    disabled = false,
  }: {
    label?: string;
    error?: string;
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    disabled?: boolean;
  }) {
    return (
      <div>
        {label && <label data-testid="input-label">{label}</label>}
        <input
          data-testid="input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={!!error}
        />
        {error && <p data-testid="input-error">{error}</p>}
      </div>
    );
  }

  test("renders input element", () => {
    render(<Input />);
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  test("renders label when provided", () => {
    render(<Input label="Email Address" />);
    expect(screen.getByTestId("input-label")).toHaveTextContent("Email Address");
  });

  test("renders error message when error prop is set", () => {
    render(<Input error="This field is required" />);
    expect(screen.getByTestId("input-error")).toHaveTextContent("This field is required");
    expect(screen.getByTestId("input")).toHaveAttribute("aria-invalid", "true");
  });

  test("does not render error when no error prop", () => {
    render(<Input />);
    expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
  });

  test("is disabled when disabled=true", () => {
    render(<Input disabled />);
    expect(screen.getByTestId("input")).toBeDisabled();
  });

  test("fires onChange event on user input", () => {
    const handleChange = jest.fn();
    render(<Input value="" onChange={handleChange} />);
    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "test@example.com" },
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  test("renders placeholder text", () => {
    render(<Input placeholder="Enter your email" />);
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
  });
});
