```json
{
  "name": "hello-world",
  "description": "A simple script that prints a greeting message.",
  "dependencies": {
    "echo": {
      "version": "1.0.0",
      "description": "A command-line utility that outputs the given arguments to the console.",
      "install": "echo is a built-in command in most shells, so no installation is required."
    }
  },
  "form": {
    "greet": {
      "type": "string",
      "label": "Greeting",
      "description": "The greeting message to display.",
      "default": "",
      "placeholder": "Enter your greeting message here",
      "validation": {
        "required": true,
        "minLength": 1,
        "maxLength": 100
      }
    }
  }
}
```

```bash
#!/usr/bin/env sh

GREET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --greet)
      GREET="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$GREET" ]; then
  echo "Usage: $0 --greet <name>" >&2
  exit 1
fi

echo "Hello, $GREET!"
```
