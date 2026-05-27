/**
 * Untitled UI adapter — the first concrete `UiKitAdapter`.
 *
 * Register a renderer per widget type here as they are ported. Types not yet
 * mapped fall through to `fallback`, so the dashboard degrades gracefully
 * during the migration instead of crashing.
 */

import type { UiKitAdapter, WidgetRenderProps } from "@/mip/adapter/types";
import { ButtonWidget } from "./button-widget";
import { CardWidget } from "./card-widget";
import { ChartWidget } from "./chart-widget";
import { CtaWidget, ContentSectionWidget, FaqWidget, FeatureGridWidget, HeroWidget, PricingWidget, StatsGridWidget, TestimonialWidget } from "./design-blocks";
import { DetailWidget } from "./detail-widget";
import { DiagramWidget } from "./diagram-widget";
import { FormWidget } from "./form-widget";
import { ElementWidget } from "./element-widget";
import { KpiWidget } from "./kpi-widget";
import { ListWidget } from "./list-widget";
import { GoogleMapWidget } from "./map-widget";
import { MarkdownWidget } from "./markdown-widget";
import { DrawerWidget, ImageWidget, ModalWidget, PageHeaderWidget } from "./misc-widgets";
import { ProgressWidget } from "./progress-widget";
import { TableWidget } from "./table-widget";
import { TabsWidget } from "./tabs-widget";
import { WidgetCard } from "./widget-card";

function ComingSoon({ widget }: WidgetRenderProps) {
    return (
        <WidgetCard title={widget.title}>
            <div className="flex flex-1 items-center justify-center text-center text-sm text-tertiary">
                <span>
                    <span className="font-mono text-secondary">{widget.type}</span> renderer coming soon
                </span>
            </div>
        </WidgetCard>
    );
}

export const untitledAdapter: UiKitAdapter = {
    id: "untitled-ui",
    name: "Untitled UI",
    widgets: {
        kpi: KpiWidget,
        progress: ProgressWidget,
        lineChart: ChartWidget,
        barChart: ChartWidget,
        areaChart: ChartWidget,
        pieChart: ChartWidget,
        donutChart: ChartWidget,
        table: TableWidget,
        list: ListWidget,
        detail: DetailWidget,
        markdown: MarkdownWidget,
        form: FormWidget,
        card: CardWidget,
        tabs: TabsWidget,
        button: ButtonWidget,
        image: ImageWidget,
        pageHeader: PageHeaderWidget,
        modal: ModalWidget,
        drawer: DrawerWidget,
        // Design blocks
        hero: HeroWidget,
        cta: CtaWidget,
        pricing: PricingWidget,
        contentSection: ContentSectionWidget,
        testimonial: TestimonialWidget,
        featureGrid: FeatureGridWidget,
        statsGrid: StatsGridWidget,
        faq: FaqWidget,
        // Diagrams (mermaid, lazy-loaded)
        flowchart: DiagramWidget,
        sequenceDiagram: DiagramWidget,
        mindmap: DiagramWidget,
        timeline: DiagramWidget,
        ganttChart: DiagramWidget,
        // Integrations
        googleMap: GoogleMapWidget,
        // Design-system atom resolved from the components catalog
        element: ElementWidget,
    },
    fallback: ComingSoon,
};
