import { Modal } from "bootstrap"
import { createSignal, flush, For, Match, onCleanup, Show, Switch, untrack } from "solid-js"

import type { Alert } from "./lib/nws.ts"

export default function Alerts(props: { alerts: Alert[] }) {
    const [showAlertDetails, setShowAlertDetails] = createSignal(false)
    const [alertDetails, setAlertDetails] = createSignal<Alert>()
    let alertDetailsModal: Modal | undefined

    const alerts = untrack(() => props.alerts)
    alerts.forEach((a) => {
        a.descriptions = a.description.split("*")
    })

    const onAlertClick = (a: Alert) => {
        setAlertDetails(a)
        setShowAlertDetails(true)
        // Bootstrap looks up the modal in the DOM, so it has to be rendered first.
        flush()

        alertDetailsModal = Modal.getOrCreateInstance("#alert-details")
        alertDetailsModal.show()
    }

    const onCloseAlertDetails = () => {
        // Closing removes the markup, and a later open renders new markup that needs its own instance.
        alertDetailsModal!.hide()
        alertDetailsModal!.dispose()
        alertDetailsModal = undefined
        setShowAlertDetails(false)
    }

    onCleanup(() => {
        // dispose() alone leaves the page scroll-locked if the modal is still open.
        alertDetailsModal?.hide()
        alertDetailsModal?.dispose()
    })

    return (
        <>
            <For each={alerts}>
                {(a) => (
                    <Switch>
                        <Match when={a.severity === "Unknown" || a.severity === "Minor"}>
                            <div
                                class="alert alert-info text-center rounded-5 p-2 shadow-sm border-4"
                                role="alert"
                                onClick={() => onAlertClick(a)}
                            >
                                <i class={"bi bi-info-circle-fill"} /> {a.event}
                            </div>
                        </Match>
                        <Match when={a.severity === "Moderate"}>
                            <div
                                class="alert alert-warning text-center rounded-5 p-2 shadow-sm border-4"
                                role="alert"
                                onClick={() => onAlertClick(a)}
                            >
                                <i class={"bi bi-exclamation-triangle-fill"} /> {a.event}
                            </div>
                        </Match>
                        <Match when={a.severity === "Severe" || a.severity === "Extreme"}>
                            <div
                                class="alert alert-danger text-center rounded-5 p-2 shadow-sm border-4"
                                role="alert"
                                onClick={() => onAlertClick(a)}
                            >
                                <i class={"bi bi-exclamation-triangle-fill"} /> {a.event}
                            </div>
                        </Match>
                    </Switch>
                )}
            </For>
            <Show when={showAlertDetails()}>
                <div id={"alert-details"} class="modal" tabindex="-1">
                    <div class="modal-dialog modal-dialog-scrollable">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">{alertDetails()?.headline}</h5>
                                <button
                                    type="button"
                                    class="btn-close"
                                    data-bs-dismiss="modal"
                                    aria-label="Close"
                                    onClick={onCloseAlertDetails}
                                ></button>
                            </div>
                            <div class="modal-body">
                                <For each={alertDetails()?.descriptions}>
                                    {(d) => (
                                        <Switch fallback={<p>{d.trim()}</p>}>
                                            <Match when={d.trim().startsWith("WHEN...")}>
                                                <p>
                                                    <strong>WHEN?</strong> {d.trim().replace("WHEN...", "")}
                                                </p>
                                            </Match>
                                            <Match when={d.trim().startsWith("WHERE...")}>
                                                <p>
                                                    <strong>WHERE?</strong> {d.trim().replace("WHERE...", "")}
                                                </p>
                                            </Match>
                                            <Match when={d.trim().startsWith("WHAT...")}>
                                                <p>
                                                    <strong>WHAT?</strong> {d.trim().replace("WHAT...", "")}
                                                </p>
                                            </Match>
                                            <Match when={d.trim().startsWith("IMPACTS...")}>
                                                <p>
                                                    <strong>IMPACTS:</strong> {d.trim().replace("IMPACTS...", "")}
                                                </p>
                                            </Match>
                                            <Match when={d.trim().startsWith("ADDITIONAL DETAILS...")}>
                                                <p>
                                                    <strong>ADDITIONAL DETAILS:</strong>{" "}
                                                    {d.trim().replace("ADDITIONAL DETAILS...", "")}
                                                </p>
                                            </Match>
                                        </Switch>
                                    )}
                                </For>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onClick={onCloseAlertDetails}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </>
    )
}
