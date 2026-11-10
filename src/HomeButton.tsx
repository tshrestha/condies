export default function HomeButton(props: { href?: string }) {
    return (
        <a href={props.href ?? "#/"} class={"btn btn-light btn-lg rounded-pill shadow border-6"} aria-label="Back">
            <i class={"bi bi-arrow-left"} />
        </a>
    )
}
