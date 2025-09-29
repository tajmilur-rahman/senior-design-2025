from bugbug import bugzilla, db

# Downland the latest version if the data set if it is not already downloaded
db.download(bugzilla.BUGS_DB)

# Iterate over all bugs in the dataset
for bug in bugzilla.get_bugs():
    # This is the same as if you retrieved the bug through Bugzilla REST API:
    # https://bmo.readthedocs.io/en/latest/api/core/v1/bug.html
    print(bug["id"])
