package util

type ChangelogAction string

const (
	ItemCreated ChangelogAction = "CREATE"
	ItemTaken   ChangelogAction = "TAKEN"
	ItemAdded   ChangelogAction = "ADDED"
	ItemDeleted ChangelogAction = "DELETE"
)
