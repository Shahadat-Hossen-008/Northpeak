import type { ComponentType } from "react";
import { getSection } from "./registry";
import type { SectionPropsMap, SectionRendererProps, SectionType } from "./interface";

export function SectionRenderer<T extends SectionType>({ type, props }: SectionRendererProps<T>) {
  const Component = getSection(type) as ComponentType<SectionPropsMap[T]>;
  if (!Component) return null;
  return <Component {...props} />;
}

export default SectionRenderer;
