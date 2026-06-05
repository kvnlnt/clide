export const theme = {
  box: {
    bg: "#282829",
    bgHover: "#303030",
    radius: {
      lg: "12px",
      md: "8px",
      sm: "4px",
    },
    space: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
    },
  },
  button: {
    bg: "#1f1f1f",
    text: "#e5e7eb",
    bgHover: "#333333",
    fontSize: {
      sm: "14px",
      md: "16px",
      lg: "18px",
    },
  },
  text: {
    primary: "#e5e7eb",
    secondary: "#9ca3af",
    size: {
      xs: "12px",
      sm: "14px",
      md: "16px",
      lg: "20px",
    },
  },
  card: {
    bg: "#1f1f1f",
    border: "#333333",
  },
  page: {
    header: {
      bg: "#1f1f1f",
      text: "#e5e7eb",
      fontSize: "24px",
    },
  },
  table: {
    header: {
      bg: "#1f1f1f",
      text: "#e5e7eb",
      fontSize: "14px",
    },
    body: {
      bg: "#282829",
      text: "#e5e7eb",
      fontSize: "16px",
    },
    footer: {
      bg: "#1f1f1f",
      text: "#e5e7eb",
      fontSize: "14px",
    },
    border: "#333333",
    padding: "4px",
  },
} as const;
