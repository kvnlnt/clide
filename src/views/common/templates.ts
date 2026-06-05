import {
  Template,
  useAttributeTrait,
  useEventTrait,
  useInnerHTMLTrait,
  useInputEventTrait,
  useInputValueTrait,
  useStyleOnEventTrait,
  useStyleTrait,
  useTextContentTrait,
} from "@linttrap/oem";

export const [tag, trait] = Template({
  attr: useAttributeTrait,
  evt: useEventTrait,
  style: useStyleTrait,
  styleOnEvt: useStyleOnEventTrait,
  text: useTextContentTrait,
  html: useInnerHTMLTrait,
  input: useInputEventTrait,
  value: useInputValueTrait,
});
