export default function LatestObservationsPlaceholder() {
    return (
        <div class={'mt-4 mb-4 text-center'}>
            <h1 class={'display-6 placeholder-glow'}>
                <span class={'placeholder placeholder-lg rounded-4 col-6'} />
            </h1>
            <h2 class={'mb-0 placeholder-glow'}>
                <span class={'placeholder placeholder-lg rounded-4 col-6'} />
            </h2>
            <div class={'d-flex justify-content-center align-items-center'}>
                <div class='col text-end placeholder-glow m-2'>
                    <h1 class={'display-1 align-middle placeholder-glow'}>
                        <span class={'placeholder placeholder-lg rounded-4 col-5'} />
                    </h1>
                </div>
                <div class='col text-start m-2'>
                    <h1 class={'display-1 align-middle placeholder-glow'}>
                        <span class={'placeholder placeholder-lg rounded-4 col-5'} />
                    </h1>
                </div>
            </div>
            <h2 class={'placeholder-glow col'}>
                <span class={'placeholder placeholder-lg rounded-4 col-6'} />
            </h2>
        </div>
    )
}
