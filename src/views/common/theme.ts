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
  formSubmissionCard: {
    bg: "#1f1f1f",
    bgHover: "#333333",
    border: "#333333",
    padding: "10px",
    label: {
      text: "#e5e7eb",
      fontSize: "14px",
    },
    body: {
      text: "#9ca3af",
      fontSize: "14px",
    },
  },
  input: {
    bg: "#1f1f1f",
    text: "#e5e7eb",
    border: "#333333",
    fontSize: {
      sm: "14px",
      md: "16px",
      lg: "18px",
    },
    padding: "10px",
  },
  modal: {
    backdrop: "rgba(0, 0, 0, 0.5)",
    bg: "#1f1f1f",
    header: {
      text: "#e5e7eb",
      fontSize: "14px",
    },
    body: {
      text: "#9ca3af",
      fontSize: "16px",
    },
    actions: {
      text: "#e5e7eb",
      fontSize: "16px",
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
  page: {
    header: {
      bg: "#1f1f1f",
      text: "#e5e7eb",
      fontSize: "24px",
    },
  },
} as const;
