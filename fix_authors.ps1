# PowerShell script to fix commit authors
$commits = @(
    "ff55b87",
    "8c71192", 
    "40560ce",
    "2de105f",
    "c3269f6"
)

Write-Host "Fixing commit authors..."

# Use filter-branch to fix all commits with LingPet Developer as author
git filter-branch -f --env-filter '
if [ "$GIT_AUTHOR_NAME" = "LingPet Developer" ]
then
    export GIT_AUTHOR_NAME="xialiag"
    export GIT_AUTHOR_EMAIL="78580207+xialiag@users.noreply.github.com"
fi
if [ "$GIT_COMMITTER_NAME" = "LingPet Developer" ]  
then
    export GIT_COMMITTER_NAME="xialiag"
    export GIT_COMMITTER_EMAIL="78580207+xialiag@users.noreply.github.com"
fi
' -- --all

Write-Host "Done fixing authors!"