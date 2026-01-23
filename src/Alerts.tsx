import { Modal } from "bootstrap"
import { createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"

import type { Alert } from "./lib/nws.ts"

export default function Alerts({ alerts }: { alerts: Alert[] }) {
    const [showAlertDetails, setShowAlertDetails] = createSignal(false)
    const [alertDetails, setAlertDetails] = createSignal<Alert>()
    const [alertDetailsModal, setAlertDetailsModal] = createSignal<Modal>()

    alerts.forEach(a => {
        a.descriptions = a.description.split("*")
    })

    const onAlertClick = (a: Alert) => {
        setAlertDetails(a)
        setShowAlertDetails(true)

        if (!alertDetailsModal()) {
            const alertDetailModal = new Modal("#alert-details")
            setAlertDetailsModal(alertDetailModal)
        }
        alertDetailsModal()!.show()
    }

    const onCloseAlertDetails = () => {
        setShowAlertDetails(false)
        alertDetailsModal()!.hide()
    }

    onCleanup(() => {
        if (alertDetailsModal()) {
            alertDetailsModal()!.dispose()
        }
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
                                onclick={() => onAlertClick(a)}
                            >
                                <i class={"bi bi-info-circle-fill"} /> {a.event}
                            </div>
                        </Match>
                        <Match when={a.severity === "Moderate"}>
                            <div
                                class="alert alert-warning text-center rounded-5 p-2 shadow-sm border-4"
                                role="alert"
                                onclick={() => onAlertClick(a)}
                            >
                                <i class={"bi bi-exclamation-triangle-fill"} /> {a.event}
                            </div>
                        </Match>
                        <Match when={a.severity === "Severe" || a.severity === "Extreme"}>
                            <div
                                class="alert alert-danger text-center rounded-5 p-2 shadow-sm border-4"
                                role="alert"
                                onclick={() => onAlertClick(a)}
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
                                    onclick={onCloseAlertDetails}
                                >
                                </button>
                            </div>
                            <div class="modal-body">
                                <For each={alertDetails()?.descriptions}>
                                    {d => (
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
                                <button type="button" class="btn btn-secondary" onclick={onCloseAlertDetails}>
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
