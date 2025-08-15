export interface NpmRegistryResponse{
    name: string
    repository?:{
        type?: "git"
        url: string
    }
    dist:{
        tarball: string
    }
}