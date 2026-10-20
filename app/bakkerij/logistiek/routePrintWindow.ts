type RoutePrintWindowOptions = {
  html: string;
  expectedStopCount: number;
};

/** Write a fresh, same-origin document in the click handler. In particular, do
 * not leave an iPad print job attached to a temporary/revoked blob document. */
export function openRoutePrintWindow({ html, expectedStopCount }: RoutePrintWindowOptions) {
  const printWindow = window.open("", "_blank", "width=950,height=800");
  if (!printWindow) {
    window.alert("Routevenster kon niet geopend worden. Sta pop-ups voor de app toe.");
    return false;
  }
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    const renderedStops = printWindow.document.querySelectorAll(".stop-card").length;
    if (renderedStops !== expectedStopCount) {
      throw new Error("De print bevat niet alle stops van het routescherm. Open de routeprint opnieuw.");
    }
    printWindow.focus();
    return true;
  } catch (cause) {
    printWindow.close();
    window.alert(cause instanceof Error ? cause.message : "De volledige route kon niet worden klaargezet. Probeer opnieuw.");
    return false;
  }
}
